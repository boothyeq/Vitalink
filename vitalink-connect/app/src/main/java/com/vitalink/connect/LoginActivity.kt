package com.vitalink.connect

import android.content.Context
import android.os.Bundle
import android.widget.Button
import androidx.appcompat.app.AppCompatActivity

class LoginActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)
        fun saveAndExit(id: String) {
            val sp = getSharedPreferences("vitalink", Context.MODE_PRIVATE)
            sp.edit().putString("patientId", id).apply()
            finish()
        }
        findViewById<Button>(R.id.btnLoginMi).setOnClickListener { saveAndExit("Mi-User-01") }
        findViewById<Button>(R.id.btnLoginFitbit).setOnClickListener { saveAndExit("Fitbit-User-01") }
    }
}