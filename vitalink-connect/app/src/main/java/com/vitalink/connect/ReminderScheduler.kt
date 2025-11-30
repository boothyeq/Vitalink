package com.vitalink.connect

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.SystemClock
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject

object ReminderScheduler {
    fun refresh(context: Context, http: OkHttpClient, baseUrl: String, patientId: String) {
        val url = baseUrl + "/patient/reminders?patientId=" + java.net.URLEncoder.encode(patientId, "UTF-8")
        try {
            val req = Request.Builder().url(url).get().build()
            val resp = http.newCall(req).execute()
            resp.use {
                if (it.code != 200) return
                val body = it.body?.string() ?: return
                val obj = JSONObject(body)
                val arr = obj.optJSONArray("reminders") ?: return
                for (i in 0 until arr.length()) {
                    val r = arr.getJSONObject(i)
                    val id = r.optString("id")
                    val title = r.optString("title")
                    val dateStr = r.optString("date")
                    val t = try { java.time.Instant.parse(dateStr) } catch (_: Exception) { null }
                    if (t != null) {
                        scheduleFor(context, id, title, t)
                    }
                }
            }
        } catch (_: Exception) {}

        try {
            val req = Request.Builder().url(baseUrl + "/patient/medications?patientId=" + java.net.URLEncoder.encode(patientId, "UTF-8")).get().build()
            val resp = http.newCall(req).execute()
            resp.use {
                if (it.code == 200) {
                    val body = it.body?.string() ?: "{}"
                    val obj = JSONObject(body)
                    val prefs = obj.optJSONObject("preferences") ?: JSONObject()
                    val hour = prefs.optInt("notify_hour", 9)
                    if (prefs.optBoolean("beta_blockers", false)) scheduleDaily(context, 11001, "Take Beta blockers", hour)
                    if (prefs.optBoolean("raas_inhibitors", false)) scheduleDaily(context, 11002, "Take RAAS inhibitors", hour)
                    if (prefs.optBoolean("mras", false)) scheduleDaily(context, 11003, "Take MRAs", hour)
                    if (prefs.optBoolean("sglt2_inhibitors", false)) scheduleDaily(context, 11004, "Take SGLT2 inhibitors", hour)
                    if (prefs.optBoolean("statin", false)) scheduleDaily(context, 11005, "Take Statin", hour)
                }
            }
        } catch (_: Exception) {}

        runCatching {
            scheduleDaily(context, 12001, "Measure weight", 8)
            scheduleDaily(context, 12002, "Measure blood pressure", 21)
        }
    }

    private fun scheduleFor(context: Context, id: String, title: String, eventInstant: java.time.Instant) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val now = java.time.Instant.now().toEpochMilli()
        val eventMs = eventInstant.toEpochMilli()
        val pairs = listOf(24 * 60 * 60 * 1000L to "Appointment tomorrow", 60 * 60 * 1000L to "Appointment in 1 hour")
        for ((offset, prefix) in pairs) {
            val fireAt = eventMs - offset
            if (fireAt > now) {
                val pi = pending(context, id + "|" + offset, prefix, title)
                try { am.cancel(pi) } catch (_: Exception) {}
                setExact(am, fireAt, pi)
            }
        }
    }

    private fun pending(context: Context, key: String, prefix: String, title: String): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java)
        intent.putExtra("title", prefix)
        intent.putExtra("body", title)
        val req = key.hashCode()
        return PendingIntent.getBroadcast(context, req, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun setExact(am: AlarmManager, whenMs: Long, pi: PendingIntent) {
        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, whenMs, pi)
    }

    private fun scheduleDaily(context: Context, requestCode: Int, title: String, hour: Int) {
        val am = context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
        val intent = Intent(context, ReminderReceiver::class.java)
        intent.putExtra("title", title)
        val pi = PendingIntent.getBroadcast(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        try { am.cancel(pi) } catch (_: Exception) {}
        val cal = java.util.Calendar.getInstance()
        cal.set(java.util.Calendar.HOUR_OF_DAY, hour)
        cal.set(java.util.Calendar.MINUTE, 0)
        cal.set(java.util.Calendar.SECOND, 0)
        if (cal.timeInMillis < System.currentTimeMillis()) cal.add(java.util.Calendar.DAY_OF_YEAR, 1)
        am.setRepeating(AlarmManager.RTC_WAKEUP, cal.timeInMillis, AlarmManager.INTERVAL_DAY, pi)
    }
}
