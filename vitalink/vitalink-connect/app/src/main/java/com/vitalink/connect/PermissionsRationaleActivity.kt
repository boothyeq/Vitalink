package com.vitalink.connect

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

class PermissionsRationaleActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val view = TextView(this)
        view.text = "This app needs Health Connect permissions to read steps data."
        setContentView(view)
    }
}