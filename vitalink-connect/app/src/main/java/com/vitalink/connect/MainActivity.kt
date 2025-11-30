package com.vitalink.connect

import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.PermissionController
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.DistanceRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import android.os.Build
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import android.widget.TableLayout
import android.widget.TableRow
import android.view.ViewGroup
import android.view.View
import android.graphics.Typeface
import android.view.Gravity
import java.time.format.DateTimeFormatter
import android.app.NotificationChannel
import android.app.NotificationManager
import androidx.core.app.NotificationManagerCompat
import android.content.pm.PackageManager
import android.Manifest

class MainActivity : AppCompatActivity() {

    private lateinit var client: HealthConnectClient
    private lateinit var http: OkHttpClient
    private lateinit var baseUrl: String
    private fun currentPatientId(): String {
        val sp = getSharedPreferences("vitalink", android.content.Context.MODE_PRIVATE)
        return sp.getString("patientId", null) ?: ""
    }
    private val originId = "android_health_connect"
    private val permissions: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(DistanceRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class)
    )
    private val requestPermissions = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract()
    ) { granted: Set<String> ->
        lifecycleScope.launch {
            val txt = findViewById<TextView>(R.id.txtOutput)
            txt.text = if (granted.containsAll(permissions)) "Permissions granted" else "Permissions missing"
            val ok = granted.containsAll(permissions)
            applyPermissionsUI(ok)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val txt = findViewById<TextView>(R.id.txtOutput)
        val btnGrant = findViewById<Button>(R.id.btnGrant)
        val btnRead = findViewById<Button>(R.id.btnRead)
        val btnScan = findViewById<Button>(R.id.btnScan)
        val btnExport = findViewById<Button>(R.id.btnExport)

        val status = HealthConnectClient.getSdkStatus(this)
        if (status != HealthConnectClient.SDK_AVAILABLE) {
            txt.text = getString(R.string.availability_missing)
            btnGrant.isEnabled = false
            btnRead.isEnabled = false
            return
        }

        client = HealthConnectClient.getOrCreate(this)
        val interceptor = HttpLoggingInterceptor()
        interceptor.level = HttpLoggingInterceptor.Level.BASIC
        http = OkHttpClient.Builder().addInterceptor(interceptor).build()
        baseUrl = getString(R.string.server_base_url)

        val pid = currentPatientId()
        if (pid.isEmpty()) {
            startActivity(android.content.Intent(this, LoginActivity::class.java))
        }

        fun updateUiForPermissions(grantedSet: Set<String>) {
            val ok = grantedSet.containsAll(permissions)
            applyPermissionsUI(ok)
        }

        lifecycleScope.launch {
            val grantedInitial = client.permissionController.getGrantedPermissions()
            updateUiForPermissions(grantedInitial)
        }

        btnGrant.setOnClickListener {
            lifecycleScope.launch {
                val granted = client.permissionController.getGrantedPermissions()
                if (!granted.containsAll(permissions)) {
                    requestPermissions.launch(permissions)
                } else {
                    updateOutputWithPermissionStatus()
                    updateUiForPermissions(granted)
                }
            }
        }

        btnRead.setOnClickListener {
            lifecycleScope.launch { ensurePatientExists(); readMetricsAndShow(txt); updateLastHourHrLabel(); updateTodayHrLabel(); updateHrDiagnostics(); syncTodayToServer(); refreshReminderNotifications() }
        }

        val scanPreview = registerForActivityResult(ActivityResultContracts.TakePicturePreview()) { _ -> }
        btnScan.setOnClickListener {
            val url = getString(R.string.scan_capture_url)
            try {
                val intent = android.content.Intent(android.content.Intent.ACTION_VIEW, android.net.Uri.parse(url))
                startActivity(intent)
            } catch (_: Exception) {
                android.widget.Toast.makeText(this, "Scan link not available", android.widget.Toast.LENGTH_SHORT).show()
            }
        }
        btnExport.setOnClickListener {
            android.widget.Toast.makeText(this, "Export coming soon", android.widget.Toast.LENGTH_SHORT).show()
        }

        findViewById<Button>(R.id.btnSwitchUser).apply {
            text = getString(R.string.logout)
            setOnClickListener {
                val sp = getSharedPreferences("vitalink", android.content.Context.MODE_PRIVATE)
                sp.edit().remove("patientId").remove("supabaseAccessToken").remove("userEmail").apply()
                startActivity(android.content.Intent(this@MainActivity, LoginActivity::class.java))
                finish()
            }
        }
    }

    private fun ensureChannel() {
        val nm = getSystemService(NotificationManager::class.java)
        val id = "reminders"
        if (nm.getNotificationChannel(id) == null) {
            val ch = NotificationChannel(id, "Reminders", NotificationManager.IMPORTANCE_DEFAULT)
            nm.createNotificationChannel(ch)
        }
    }

    private fun hasNotifPermission(): Boolean {
        return if (android.os.Build.VERSION.SDK_INT >= 33) checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED else true
    }

    private suspend fun refreshReminderNotifications() {
        ensureChannel()
        if (!hasNotifPermission()) return
        val pid = currentPatientId()
        if (pid.isEmpty()) return
        withContext(Dispatchers.IO) {
            ReminderScheduler.refresh(this@MainActivity, http, baseUrl, pid)
        }
    }

    private suspend fun updateOutputWithPermissionStatus() {
        val granted = client.permissionController.getGrantedPermissions()
        val txt = findViewById<TextView>(R.id.txtOutput)
        txt.text = if (granted.containsAll(permissions)) "Permissions granted" else "Permissions missing"
        applyPermissionsUI(granted.containsAll(permissions))
        }

    private fun applyPermissionsUI(ok: Boolean) {
        val btnRead = findViewById<Button>(R.id.btnRead)
        val bannerBox = findViewById<android.widget.LinearLayout>(R.id.bannerBox)
        val bannerAccent = findViewById<View>(R.id.bannerAccent)
        val txtBannerTitle = findViewById<TextView>(R.id.txtBannerTitle)
        val txtBannerDesc = findViewById<TextView>(R.id.txtBannerDesc)
        btnRead.isEnabled = ok
        if (ok) {
            bannerBox.setBackgroundResource(R.drawable.banner_granted)
            bannerAccent.setBackgroundResource(R.color.bannerGrantedAccent)
            txtBannerTitle.text = getString(R.string.banner_title_granted)
            txtBannerDesc.text = getString(R.string.banner_desc_granted)
        } else {
            bannerBox.setBackgroundResource(R.drawable.banner_required)
            bannerAccent.setBackgroundResource(R.color.bannerRequiredAccent)
            txtBannerTitle.text = getString(R.string.banner_title_required)
            txtBannerDesc.text = getString(R.string.banner_desc_required)
        }
    }

    private suspend fun ensurePatientExists() {
        val pid = currentPatientId()
        if (pid.isEmpty()) return
        val sp = getSharedPreferences("vitalink", android.content.Context.MODE_PRIVATE)
        val email = sp.getString("userEmail", null)
        val namePart = (email ?: "").substringBefore("@")
        val firstName = namePart.replace(Regex("[^A-Za-z]"), "").ifEmpty { "User" }
        val lastName = "Patient"
        val json = "{\"patientId\":\"" + pid + "\",\"firstName\":\"" + firstName + "\",\"lastName\":\"" + lastName + "\"}"
        val body = json.toRequestBody("application/json".toMediaType())
        val req = Request.Builder().url(baseUrl + "/admin/ensure-patient").post(body).build()
        withContext(Dispatchers.IO) { try { http.newCall(req).execute().close() } catch (_: Exception) {} }
    }

    private suspend fun readMetricsAndShow(txt: TextView) {
        val granted = client.permissionController.getGrantedPermissions()
        if (!granted.containsAll(permissions)) {
            txt.text = "Permissions missing"
            return
        }
        val nowInstant = Instant.now()
        val sevenDaysAgo = nowInstant.minusSeconds(7 * 24 * 60 * 60)
        val steps7d = client.readRecords(
            ReadRecordsRequest(
                StepsRecord::class,
                timeRangeFilter = TimeRangeFilter.between(sevenDaysAgo, nowInstant)
            )
        ).records
        val totalSteps = steps7d.fold(0L) { acc, r -> acc + r.count }

        val hr7d = client.readRecords(
            ReadRecordsRequest(
                HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(sevenDaysAgo, nowInstant)
            )
        ).records
        val samples7d = hr7d.flatMap { it.samples }
        val avgHr = if (samples7d.isNotEmpty()) (samples7d.sumOf { it.beatsPerMinute } / samples7d.size).toInt() else null

        val zone = ZoneId.systemDefault()
        val dateFormatter = DateTimeFormatter.ofPattern("dd/MM/yy")
        val endPeriod = nowInstant
        val startPeriod = endPeriod.minus(30, ChronoUnit.DAYS)
        val steps30d = client.readRecords(
            ReadRecordsRequest(
                StepsRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startPeriod, endPeriod)
            )
        ).records
        val endDate = LocalDateTime.ofInstant(endPeriod, zone).toLocalDate()
        val dailyMap = linkedMapOf<java.time.LocalDate, Long>()
        for (i in 0..29) {
            val day = endDate.minusDays(i.toLong())
            dailyMap[day] = 0L
        }
        steps30d.forEach { r ->
            val day = LocalDateTime.ofInstant(r.endTime, zone).toLocalDate()
            if (dailyMap.containsKey(day)) {
                dailyMap[day] = (dailyMap[day] ?: 0L) + r.count
            }
        }
        val hr30d = client.readRecords(
            ReadRecordsRequest(
                HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startPeriod, endPeriod)
            )
        ).records
        data class HrAgg(var min: Long = Long.MAX_VALUE, var max: Long = Long.MIN_VALUE, var sum: Long = 0L, var count: Int = 0)
        val hrDaily = linkedMapOf<java.time.LocalDate, HrAgg>()
        for (i in 0..29) {
            val day = endDate.minusDays(i.toLong())
            hrDaily[day] = HrAgg()
        }
        hr30d.forEach { rec ->
            rec.samples.forEach { s ->
                val day = LocalDateTime.ofInstant(s.time, zone).toLocalDate()
                val agg = hrDaily[day]
                if (agg != null) {
                    if (s.beatsPerMinute < agg.min) agg.min = s.beatsPerMinute
                    if (s.beatsPerMinute > agg.max) agg.max = s.beatsPerMinute
                    agg.sum += s.beatsPerMinute
                    agg.count += 1
                }
            }
        }

        val tbl = findViewById<TableLayout>(R.id.tblData)
        tbl.removeAllViews()

        fun addCell(text: String, bold: Boolean): TextView {
            val tv = TextView(this)
            tv.text = text
            tv.setPadding(16, 12, 16, 12)
            tv.gravity = Gravity.START
            if (bold) tv.setTypeface(tv.typeface, Typeface.BOLD)
            tv.layoutParams = TableRow.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            return tv
        }

        val header = TableRow(this)
        header.addView(addCell("Date", true))
        header.addView(addCell("Steps", true))
        header.addView(addCell("HR Min", true))
        header.addView(addCell("HR Max", true))
        header.addView(addCell("HR Avg", true))
        tbl.addView(header)

        val days = dailyMap.keys.toList().sorted()
        days.forEach { day ->
            val row = TableRow(this)
            val steps = dailyMap[day] ?: 0L
            val hrAgg = hrDaily[day]
            val min = if (hrAgg != null && hrAgg.count > 0) hrAgg.min else 0L
            val max = if (hrAgg != null && hrAgg.count > 0) hrAgg.max else 0L
            val avg = if (hrAgg != null && hrAgg.count > 0) (hrAgg.sum / hrAgg.count) else 0L
            row.addView(addCell(day.format(dateFormatter), false))
            row.addView(addCell(steps.toString(), false))
            row.addView(addCell(min.toString(), false))
            row.addView(addCell(max.toString(), false))
            row.addView(addCell(avg.toString(), false))
            tbl.addView(row)
        }

        val timeFormatter = DateTimeFormatter.ofPattern("HH:mm")
        val today = LocalDateTime.ofInstant(nowInstant, zone).toLocalDate()
        val startOfToday = today.atStartOfDay(zone).toInstant()
        val stepsToday = client.readRecords(
            ReadRecordsRequest(
                StepsRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startOfToday, endPeriod)
            )
        ).records
        val hrToday = client.readRecords(
            ReadRecordsRequest(
                HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startOfToday, endPeriod)
            )
        ).records
        val spo2Today = client.readRecords(
            ReadRecordsRequest(
                OxygenSaturationRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startOfToday, endPeriod)
            )
        ).records

        val hourlyStepsToday = linkedMapOf<LocalDateTime, Long>()
        for (i in 0..23) {
            val slot = today.atStartOfDay().plusHours(i.toLong())
            val slotZ = slot.atZone(zone).toLocalDateTime()
            hourlyStepsToday[slotZ] = 0L
        }
        stepsToday.forEach { r ->
            val key = LocalDateTime.ofInstant(r.endTime, zone).truncatedTo(ChronoUnit.HOURS)
            if (hourlyStepsToday.containsKey(key)) {
                hourlyStepsToday[key] = (hourlyStepsToday[key] ?: 0L) + r.count
            }
        }

        data class HrHour(var min: Long = Long.MAX_VALUE, var max: Long = Long.MIN_VALUE, var sum: Long = 0L, var count: Int = 0)
        val hourlyHrToday = linkedMapOf<LocalDateTime, HrHour>()
        for (i in 0..23) {
            val slot = today.atStartOfDay().plusHours(i.toLong())
            val slotZ = slot.atZone(zone).toLocalDateTime()
            hourlyHrToday[slotZ] = HrHour()
        }
        val hrLog = mutableListOf<Pair<LocalDateTime, Long>>()
        val spo2Log = mutableListOf<Pair<LocalDateTime, Double>>()
        hrToday.forEach { rec ->
            rec.samples.forEach { s ->
                val key = LocalDateTime.ofInstant(s.time, zone).truncatedTo(ChronoUnit.HOURS)
                val agg = hourlyHrToday[key]
                if (agg != null) {
                    if (s.beatsPerMinute < agg.min) agg.min = s.beatsPerMinute.toLong()
                    if (s.beatsPerMinute > agg.max) agg.max = s.beatsPerMinute.toLong()
                    agg.sum += s.beatsPerMinute
                    agg.count += 1
                }
                hrLog.add(LocalDateTime.ofInstant(s.time, zone) to s.beatsPerMinute.toLong())
            }
        }
        spo2Today.forEach { r ->
            val t = LocalDateTime.ofInstant(r.time, zone)
            spo2Log.add(t to r.percentage.value)
        }

        val todayLabel = TableRow(this)
        todayLabel.addView(addCell("Today Hourly", true))
        todayLabel.addView(addCell("", true))
        todayLabel.addView(addCell("", true))
        todayLabel.addView(addCell("", true))
        todayLabel.addView(addCell("", true))
        tbl.addView(todayLabel)

        val headerToday = TableRow(this)
        headerToday.addView(addCell("Hour", true))
        headerToday.addView(addCell("Steps", true))
        headerToday.addView(addCell("HR Min", true))
        headerToday.addView(addCell("HR Max", true))
        headerToday.addView(addCell("HR Avg", true))
        tbl.addView(headerToday)

        val hours = hourlyStepsToday.keys.toList().sorted()
        hours.forEach { h ->
            val row = TableRow(this)
            val steps = hourlyStepsToday[h] ?: 0L
            val agg = hourlyHrToday[h]
            val min = if (agg != null && agg.count > 0) agg.min else 0L
            val max = if (agg != null && agg.count > 0) agg.max else 0L
            val avg = if (agg != null && agg.count > 0) (agg.sum / agg.count) else 0L
            row.addView(addCell(h.format(timeFormatter), false))
            row.addView(addCell(steps.toString(), false))
            row.addView(addCell(min.toString(), false))
            row.addView(addCell(max.toString(), false))
            row.addView(addCell(avg.toString(), false))
            tbl.addView(row)
        }

        val cutoff = LocalDateTime.ofInstant(nowInstant.minus(30, ChronoUnit.MINUTES), zone)

        val logsLabel = TableRow(this)
        logsLabel.addView(addCell("Recent 30 min HR", true))
        logsLabel.addView(addCell("", true))
        logsLabel.addView(addCell("", true))
        logsLabel.addView(addCell("", true))
        logsLabel.addView(addCell("", true))
        tbl.addView(logsLabel)

        val headerLogs = TableRow(this)
        headerLogs.addView(addCell("Time", true))
        headerLogs.addView(addCell("BPM", true))
        tbl.addView(headerLogs)

        hrLog.filter { it.first >= cutoff }.sortedBy { it.first }.forEach { (t, bpm) ->
            val row = TableRow(this)
            row.addView(addCell(t.format(timeFormatter), false))
            row.addView(addCell(bpm.toString(), false))
            tbl.addView(row)
        }

        val spo2Label = TableRow(this)
        spo2Label.addView(addCell("Recent 30 min SpO2", true))
        spo2Label.addView(addCell("", true))
        spo2Label.addView(addCell("", true))
        spo2Label.addView(addCell("", true))
        spo2Label.addView(addCell("", true))
        tbl.addView(spo2Label)

        val headerSpo2 = TableRow(this)
        headerSpo2.addView(addCell("Time", true))
        headerSpo2.addView(addCell("%", true))
        tbl.addView(headerSpo2)

        spo2Log.filter { it.first >= cutoff }.sortedBy { it.first }.forEach { (t, pct) ->
            val row = TableRow(this)
            row.addView(addCell(t.format(timeFormatter), false))
            row.addView(addCell(pct.toString(), false))
            tbl.addView(row)
        }

        txt.text = "Permissions granted"
    }

    private suspend fun updateLastHourHrLabel() {
        val tv = findViewById<TextView>(R.id.txtHrLastHour)
        val granted = client.permissionController.getGrantedPermissions()
        if (!granted.containsAll(permissions)) {
            tv.text = getString(R.string.hr_last_hour_no_samples)
            return
        }
        val nowInstant = Instant.now()
        val start = nowInstant.minus(1, ChronoUnit.HOURS)
        val hr = client.readRecords(
            ReadRecordsRequest(
                HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, nowInstant)
            )
        ).records
        var min = Long.MAX_VALUE
        var max = Long.MIN_VALUE
        var sum = 0L
        var count = 0
        hr.forEach { rec ->
            rec.samples.forEach { s ->
                val bpm = s.beatsPerMinute.toLong()
                if (bpm < min) min = bpm
                if (bpm > max) max = bpm
                sum += bpm
                count += 1
            }
        }
        if (count == 0) {
            tv.text = getString(R.string.hr_last_hour_no_samples)
        } else {
            val avg = (sum / count).toInt()
            tv.text = getString(R.string.hr_last_hour, min.toInt(), max.toInt(), avg)
        }
    }

    private suspend fun updateTodayHrLabel() {
        val tv = findViewById<TextView>(R.id.txtHrToday)
        val granted = client.permissionController.getGrantedPermissions()
        if (!granted.containsAll(permissions)) {
            tv.text = getString(R.string.hr_today_no_samples)
            return
        }
        val nowInstant = Instant.now()
        val zone = ZoneId.systemDefault()
        val today = LocalDateTime.ofInstant(nowInstant, zone).toLocalDate()
        val start = today.atStartOfDay(zone).toInstant()
        val hr = client.readRecords(
            ReadRecordsRequest(
                HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start, nowInstant)
            )
        ).records
        var min = Long.MAX_VALUE
        var max = Long.MIN_VALUE
        var sum = 0L
        var count = 0
        hr.forEach { rec ->
            rec.samples.forEach { s ->
                val bpm = s.beatsPerMinute.toLong()
                if (bpm < min) min = bpm
                if (bpm > max) max = bpm
                sum += bpm
                count += 1
            }
        }
        if (count == 0) {
            tv.text = getString(R.string.hr_today_no_samples)
        } else {
            val avg = (sum / count).toInt()
            tv.text = getString(R.string.hr_today, min.toInt(), max.toInt(), avg)
        }
    }

    private suspend fun updateHrDiagnostics() {
        val tv = findViewById<TextView>(R.id.txtHrDiag)
        val granted = client.permissionController.getGrantedPermissions()
        if (!granted.containsAll(permissions)) {
            tv.text = getString(R.string.hr_diag, 0, 0, "-")
            return
        }
        val nowInstant = Instant.now()
        val zone = ZoneId.systemDefault()
        val today = LocalDateTime.ofInstant(nowInstant, zone).toLocalDate()
        val startToday = today.atStartOfDay(zone).toInstant()
        val start7d = nowInstant.minusSeconds(7 * 24 * 60 * 60)
        val fmt = DateTimeFormatter.ofPattern("dd/MM HH:mm")
        val hrToday = client.readRecords(
            ReadRecordsRequest(
                HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startToday, nowInstant)
            )
        ).records
        val hr7d = client.readRecords(
            ReadRecordsRequest(
                HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(start7d, nowInstant)
            )
        ).records
        var todayCount = 0
        var weekCount = 0
        var lastTs: LocalDateTime? = null
        hrToday.forEach { rec ->
            todayCount += rec.samples.size
            rec.samples.forEach { s ->
                val t = LocalDateTime.ofInstant(s.time, zone)
                if (lastTs == null || t.isAfter(lastTs)) lastTs = t
            }
        }
        hr7d.forEach { rec -> weekCount += rec.samples.size }
        val lastStr = if (lastTs != null) lastTs!!.format(fmt) else "-"
        tv.text = getString(R.string.hr_diag, todayCount, weekCount, lastStr)
    }

    private suspend fun syncTodayToServer() {
        val granted = client.permissionController.getGrantedPermissions()
        if (!granted.containsAll(permissions)) return
        val txt = findViewById<TextView>(R.id.txtOutput)
        var reachable = false
        withContext(Dispatchers.IO) {
            try {
                val req = Request.Builder().url(baseUrl + "/health").get().build()
                val resp = http.newCall(req).execute()
                resp.use { reachable = (it.code == 200) }
            } catch (_: Exception) {
                reachable = false
            }
            if (!reachable) {
                val candidates = listOf(baseUrl, "http://127.0.0.1:3001", "http://10.0.2.2:3001")
                for (u in candidates.distinct()) {
                    try {
                        val r = Request.Builder().url(u + "/health").get().build()
                        val s = http.newCall(r).execute()
                        s.use { if (it.code == 200) { baseUrl = u; reachable = true } }
                    } catch (_: Exception) {}
                    if (reachable) break
                }
            }
        }
        if (!reachable) {
            val nowInstant = Instant.now()
            val zone = ZoneId.systemDefault()
            val today = LocalDateTime.ofInstant(nowInstant, zone).toLocalDate()
            val startOfToday = today.atStartOfDay(zone).toInstant()
            val stepsToday = client.readRecords(
                ReadRecordsRequest(
                    StepsRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startOfToday, nowInstant)
                )
            ).records
            val distanceToday = client.readRecords(
                ReadRecordsRequest(
                    DistanceRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startOfToday, nowInstant)
                )
            ).records
            val hrToday = client.readRecords(
                ReadRecordsRequest(
                    HeartRateRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startOfToday, nowInstant)
                )
            ).records
            val spo2Today = client.readRecords(
                ReadRecordsRequest(
                    OxygenSaturationRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(startOfToday, nowInstant)
                )
            ).records
            val deviceId = Build.MODEL ?: "device"
            val offsetMin = zone.rules.getOffset(nowInstant).totalSeconds / 60
            val patientId = currentPatientId()
            if (patientId.isEmpty()) { txt.text = "login required"; return }
            val db = LocalDb.get(this)
            val dao = db.dao()
            withContext(Dispatchers.IO) {
                stepsToday.forEach { r ->
                    val start = r.startTime; val end = r.endTime
                    val uid = patientId + "|" + originId + "|" + deviceId + "|" + start.toEpochMilli() + "|" + end.toEpochMilli() + "|" + r.count
                    dao.insertSteps(PendingSteps(uid, patientId, originId, deviceId, start.toString(), end.toString(), r.count, offsetMin))
                }
                distanceToday.forEach { r ->
                    val start = r.startTime; val end = r.endTime
                    val meters = r.distance.inMeters
                    val uid = patientId + "|" + originId + "|" + deviceId + "|" + start.toEpochMilli() + "|" + end.toEpochMilli() + "|" + meters
                    dao.insertDistance(PendingDistance(uid, patientId, originId, deviceId, start.toString(), end.toString(), meters, offsetMin))
                }
                hrToday.forEach { rec ->
                
                    rec.samples.forEach { s ->
                        val t = s.time
                        val uid = patientId + "|" + originId + "|" + deviceId + "|" + t.toEpochMilli() + "|" + s.beatsPerMinute
                        dao.insertHr(PendingHr(uid, patientId, originId, deviceId, t.toString(), s.beatsPerMinute, offsetMin))
                    }
                }
                spo2Today.forEach { r ->
                    val t = r.time
                    val uid = patientId + "|" + originId + "|" + deviceId + "|" + t.toEpochMilli() + "|" + r.percentage.value
                    dao.insertSpo2(PendingSpo2(uid, patientId, originId, deviceId, t.toString(), r.percentage.value, offsetMin))
                }
            }
            txt.text = "queued offline"
            return
        }
        val nowInstant = Instant.now()
        val zone = ZoneId.systemDefault()
        val today = LocalDateTime.ofInstant(nowInstant, zone).toLocalDate()
        val startOfToday = today.atStartOfDay(zone).toInstant()
        val stepsToday = client.readRecords(
            ReadRecordsRequest(
                StepsRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startOfToday, nowInstant)
            )
        ).records
        val distanceToday = client.readRecords(
            ReadRecordsRequest(
                DistanceRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startOfToday, nowInstant)
            )
        ).records
        val hrToday = client.readRecords(
            ReadRecordsRequest(
                HeartRateRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startOfToday, nowInstant)
            )
        ).records
        val spo2Today = client.readRecords(
            ReadRecordsRequest(
                OxygenSaturationRecord::class,
                timeRangeFilter = TimeRangeFilter.between(startOfToday, nowInstant)
            )
        ).records
        val deviceId = Build.MODEL ?: "device"
        val offsetMin = zone.rules.getOffset(nowInstant).totalSeconds / 60
        val patientId = currentPatientId()
        if (patientId.isEmpty()) {
            txt.text = "login required"
            return
        }
        val sp = getSharedPreferences("vitalink", android.content.Context.MODE_PRIVATE)
        val email = sp.getString("userEmail", null)
        val namePart = (email ?: "").substringBefore("@")
        val firstName = namePart.replace(Regex("[^A-Za-z]"), "").ifEmpty { "User" }
        val lastName = "Patient"
        val stepsItems = stepsToday.map { r ->
            val start = r.startTime
            val end = r.endTime
            val uid = patientId + "|" + originId + "|" + deviceId + "|" + start.toEpochMilli() + "|" + end.toEpochMilli() + "|" + r.count
            "{" +
                "\"patientId\":\"" + patientId + "\"," +
                "\"originId\":\"" + originId + "\"," +
                "\"deviceId\":\"" + deviceId + "\"," +
                "\"startTs\":\"" + start.toString() + "\"," +
                "\"endTs\":\"" + end.toString() + "\"," +
                "\"count\":" + r.count + "," +
                "\"recordUid\":\"" + uid + "\"," +
                "\"firstName\":\"" + firstName + "\"," +
                "\"lastName\":\"" + lastName + "\"," +
                "\"tzOffsetMin\":" + offsetMin +
            "}"
        }
        val distanceItems = distanceToday.map { r ->
            val start = r.startTime
            val end = r.endTime
            val meters = r.distance.inMeters
            val uid = patientId + "|" + originId + "|" + deviceId + "|" + start.toEpochMilli() + "|" + end.toEpochMilli() + "|" + meters
            "{" +
                "\"patientId\":\"" + patientId + "\"," +
                "\"originId\":\"" + originId + "\"," +
                "\"deviceId\":\"" + deviceId + "\"," +
                "\"startTs\":\"" + start.toString() + "\"," +
                "\"endTs\":\"" + end.toString() + "\"," +
                "\"meters\":" + meters + "," +
                "\"recordUid\":\"" + uid + "\"," +
                "\"firstName\":\"" + firstName + "\"," +
                "\"lastName\":\"" + lastName + "\"," +
                "\"tzOffsetMin\":" + offsetMin +
            "}"
        }
        val hrItems = mutableListOf<String>()
        hrToday.forEach { rec ->
            rec.samples.forEach { s ->
                val t = s.time
                val uid = patientId + "|" + originId + "|" + deviceId + "|" + t.toEpochMilli() + "|" + s.beatsPerMinute
                hrItems.add(
                    "{" +
                        "\"patientId\":\"" + patientId + "\"," +
                        "\"originId\":\"" + originId + "\"," +
                        "\"deviceId\":\"" + deviceId + "\"," +
                        "\"timeTs\":\"" + t.toString() + "\"," +
                        "\"bpm\":" + s.beatsPerMinute + "," +
                        "\"recordUid\":\"" + uid + "\"," +
                        "\"firstName\":\"" + firstName + "\"," +
                        "\"lastName\":\"" + lastName + "\"," +
                        "\"tzOffsetMin\":" + offsetMin +
                    "}"
                )
            }
        }
        if (hrItems.isEmpty()) {
            val nowInstant2 = Instant.now()
            val start24h = nowInstant2.minus(24, ChronoUnit.HOURS)
            val hr24h = client.readRecords(
                ReadRecordsRequest(
                    HeartRateRecord::class,
                    timeRangeFilter = TimeRangeFilter.between(start24h, nowInstant2)
                )
            ).records
            hr24h.forEach { rec ->
                rec.samples.forEach { s ->
                    val t = s.time
                    val uid = patientId + "|" + originId + "|" + deviceId + "|" + t.toEpochMilli() + "|" + s.beatsPerMinute
                    hrItems.add(
                        "{" +
                            "\"patientId\":\"" + patientId + "\"," +
                            "\"originId\":\"" + originId + "\"," +
                            "\"deviceId\":\"" + deviceId + "\"," +
                            "\"timeTs\":\"" + t.toString() + "\"," +
                            "\"bpm\":" + s.beatsPerMinute + "," +
                            "\"recordUid\":\"" + uid + "\"," +
                            "\"tzOffsetMin\":" + offsetMin +
                        "}"
                    )
                }
            }
        }
        val spo2Items = spo2Today.map { r ->
            val t = r.time
            val pct = r.percentage.value
            val uid = patientId + "|" + originId + "|" + deviceId + "|" + t.toEpochMilli() + "|" + pct
            "{" +
                "\"patientId\":\"" + patientId + "\"," +
                "\"originId\":\"" + originId + "\"," +
                "\"deviceId\":\"" + deviceId + "\"," +
                "\"timeTs\":\"" + t.toString() + "\"," +
                "\"spo2Pct\":" + pct + "," +
                "\"recordUid\":\"" + uid + "\"," +
                "\"firstName\":\"" + firstName + "\"," +
                "\"lastName\":\"" + lastName + "\"," +
                "\"tzOffsetMin\":" + offsetMin +
            "}"
        }
        val stepsJson = "[" + stepsItems.joinToString(",") + "]"
        val distanceJson = "[" + distanceItems.joinToString(",") + "]"
        val hrJson = "[" + hrItems.joinToString(",") + "]"
        val spo2Json = "[" + spo2Items.joinToString(",") + "]"
        val jsonType = "application/json".toMediaType()
        val stepsBody: RequestBody = stepsJson.toRequestBody(jsonType)
        val distanceBody: RequestBody = distanceJson.toRequestBody(jsonType)
        val hrBody: RequestBody = hrJson.toRequestBody(jsonType)
        val spo2Body: RequestBody = spo2Json.toRequestBody(jsonType)
        val stepsReq = Request.Builder().url(baseUrl + "/ingest/steps-events").post(stepsBody).build()
        val distanceReq = Request.Builder().url(baseUrl + "/ingest/distance-events").post(distanceBody).build()
        val hrReq = Request.Builder().url(baseUrl + "/ingest/hr-samples").post(hrBody).build()
        val spo2Req = Request.Builder().url(baseUrl + "/ingest/spo2-samples").post(spo2Body).build()
        var status = ""
        withContext(Dispatchers.IO) {
            val stepsCount = stepsItems.size
            val distanceCount = distanceItems.size
            val hrCount = hrItems.size
            val spo2Count = spo2Items.size
            try {
                val resp = http.newCall(stepsReq).execute()
                resp.use {
                    status = "steps=" + stepsCount + ", code=" + it.code
                }
            } catch (_: Exception) {
                status = "steps=" + stepsCount + ", error"
            }
            try {
                val resp = http.newCall(distanceReq).execute()
                resp.use {
                    status = status + "; distance=" + distanceCount + ", code=" + it.code
                }
            } catch (_: Exception) {
                status = status + "; distance=" + distanceCount + ", error"
            }
            try {
                val resp = http.newCall(hrReq).execute()
                resp.use {
                    if (it.code == 200) {
                        status = status + "; hr=" + hrCount + ", code=200"
                    } else {
                        val err = try { it.body?.string() ?: "" } catch (_: Exception) { "" }
                        status = status + "; hr=" + hrCount + ", code=" + it.code + if (err.isNotEmpty()) ", msg=" + err else ""
                    }
                }
            } catch (_: Exception) {
                status = status + "; hr=" + hrCount + ", error"
            }
            try {
                val resp = http.newCall(spo2Req).execute()
                resp.use {
                    status = status + "; spo2=" + spo2Count + ", code=" + it.code
                }
            } catch (_: Exception) {
                status = status + "; spo2=" + spo2Count + ", error"
            }
            try {
                val db = LocalDb.get(this@MainActivity)
                val dao = db.dao()
                val jsonType = "application/json".toMediaType()
                val queuedSteps = dao.getSteps(500)
                if (queuedSteps.isNotEmpty()) {
                    val payload = queuedSteps.map { i ->
                        "{" +
                            "\"patientId\":\"" + i.patientId + "\"," +
                            "\"originId\":\"" + i.originId + "\"," +
                            "\"deviceId\":\"" + i.deviceId + "\"," +
                            "\"startTs\":\"" + i.startTs + "\"," +
                            "\"endTs\":\"" + i.endTs + "\"," +
                            "\"count\":" + i.count + "," +
                            "\"recordUid\":\"" + i.recordUid + "\"," +
                            "\"firstName\":\"" + firstName + "\"," +
                            "\"lastName\":\"" + lastName + "\"," +
                            "\"tzOffsetMin\":" + i.tzOffsetMin +
                        "}"
                    }
                    val body = ("[" + payload.joinToString(",") + "]").toRequestBody(jsonType)
                    val req = Request.Builder().url(baseUrl + "/ingest/steps-events").post(body).build()
                    val resp = http.newCall(req).execute()
                    resp.use { if (it.code == 200) dao.deleteSteps(queuedSteps.map { q -> q.recordUid }) }
                }
                val queuedDistance = dao.getDistance(500)
                if (queuedDistance.isNotEmpty()) {
                    val payload = queuedDistance.map { i ->
                        "{" +
                            "\"patientId\":\"" + i.patientId + "\"," +
                            "\"originId\":\"" + i.originId + "\"," +
                            "\"deviceId\":\"" + i.deviceId + "\"," +
                            "\"startTs\":\"" + i.startTs + "\"," +
                            "\"endTs\":\"" + i.endTs + "\"," +
                            "\"meters\":" + i.meters + "," +
                            "\"recordUid\":\"" + i.recordUid + "\"," +
                            "\"tzOffsetMin\":" + i.tzOffsetMin +
                        "}"
                    }
                    val body = ("[" + payload.joinToString(",") + "]").toRequestBody(jsonType)
                    val req = Request.Builder().url(baseUrl + "/ingest/distance-events").post(body).build()
                    val resp = http.newCall(req).execute()
                    resp.use { if (it.code == 200) dao.deleteDistance(queuedDistance.map { q -> q.recordUid }) }
                }
                val queuedHr = dao.getHr(1000)
                if (queuedHr.isNotEmpty()) {
                    val payload = queuedHr.map { i ->
                        "{" +
                            "\"patientId\":\"" + i.patientId + "\"," +
                            "\"originId\":\"" + i.originId + "\"," +
                            "\"deviceId\":\"" + i.deviceId + "\"," +
                            "\"timeTs\":\"" + i.timeTs + "\"," +
                            "\"bpm\":" + i.bpm + "," +
                            "\"recordUid\":\"" + i.recordUid + "\"," +
                            "\"firstName\":\"" + firstName + "\"," +
                            "\"lastName\":\"" + lastName + "\"," +
                            "\"tzOffsetMin\":" + i.tzOffsetMin +
                        "}"
                    }
                    val body = ("[" + payload.joinToString(",") + "]").toRequestBody(jsonType)
                    val req = Request.Builder().url(baseUrl + "/ingest/hr-samples").post(body).build()
                    val resp = http.newCall(req).execute()
                    resp.use { if (it.code == 200) dao.deleteHr(queuedHr.map { q -> q.recordUid }) }
                }
                val queuedSpo2 = dao.getSpo2(1000)
                if (queuedSpo2.isNotEmpty()) {
                    val payload = queuedSpo2.map { i ->
                        "{" +
                            "\"patientId\":\"" + i.patientId + "\"," +
                            "\"originId\":\"" + i.originId + "\"," +
                            "\"deviceId\":\"" + i.deviceId + "\"," +
                            "\"timeTs\":\"" + i.timeTs + "\"," +
                            "\"spo2Pct\":" + i.spo2Pct + "," +
                            "\"recordUid\":\"" + i.recordUid + "\"," +
                            "\"firstName\":\"" + firstName + "\"," +
                            "\"lastName\":\"" + lastName + "\"," +
                            "\"tzOffsetMin\":" + i.tzOffsetMin +
                        "}"
                    }
                    val body = ("[" + payload.joinToString(",") + "]").toRequestBody(jsonType)
                    val req = Request.Builder().url(baseUrl + "/ingest/spo2-samples").post(body).build()
                    val resp = http.newCall(req).execute()
                    resp.use { if (it.code == 200) dao.deleteSpo2(queuedSpo2.map { q -> q.recordUid }) }
                }
            } catch (_: Exception) {}
        }
        txt.text = status
    }
}
