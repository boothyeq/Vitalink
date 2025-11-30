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
}
