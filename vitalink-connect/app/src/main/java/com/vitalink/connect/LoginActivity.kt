package com.vitalink.connect

import android.content.Context
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.providers.builtin.Email
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.logging.HttpLoggingInterceptor

class LoginActivity : AppCompatActivity() {
    private lateinit var http: OkHttpClient
    private lateinit var baseUrl: String

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_login)

        val interceptor = HttpLoggingInterceptor()
        interceptor.level = HttpLoggingInterceptor.Level.BASIC
        http = OkHttpClient.Builder().addInterceptor(interceptor).build()

        // Ensure these exist in your BuildConfig or replace with hardcoded strings for testing
        baseUrl = getString(R.string.server_base_url)

        val supabase = createSupabaseClient(
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabaseKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY
        ) {
            install(Auth)
        }

        val editEmail = findViewById<EditText>(R.id.editEmail)
        val editPassword = findViewById<EditText>(R.id.editPassword)
        val btnRegister = findViewById<Button>(R.id.btnRegister)
        val btnLoginEmail = findViewById<Button>(R.id.btnLoginEmail)

        btnRegister.setOnClickListener {
            // FIX 1: Renamed variables to avoid shadowing conflicts
            val inputEmail = editEmail.text.toString().trim().lowercase()
            val inputPassword = editPassword.text.toString()

            if (inputEmail.isEmpty() || inputPassword.isEmpty()) {
                Toast.makeText(this, "Enter email and password", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            lifecycleScope.launch {
                try {
                    withContext(Dispatchers.IO) {
                        supabase.auth.signUpWith(Email) {
                            // FIX 1: Assign inputEmail to the builder's email property
                            email = inputEmail
                            password = inputPassword
                        }
                    }

                    // FIX 2: Use currentSessionOrNull() instead of currentSession
                    val session = supabase.auth.currentSessionOrNull()
                    val uid = session?.user?.id ?: ""

                    if (uid.isNotEmpty()) {
                        val sp = getSharedPreferences("vitalink", Context.MODE_PRIVATE)
                        val token = session?.accessToken ?: ""
                        sp.edit()
                            .putString("patientId", uid)
                            .putString("supabaseAccessToken", token)
                            .putString("userEmail", inputEmail)
                            .apply()
                        finish()
                    } else {
                        Toast.makeText(this@LoginActivity, "Registration failed", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@LoginActivity, "Registration error: " + (e.message ?: ""), Toast.LENGTH_SHORT).show()
                }
            }
        }

        btnLoginEmail.setOnClickListener {
            // FIX 1: Renamed variable
            val inputEmail = editEmail.text.toString().trim().lowercase()
            val inputPassword = editPassword.text.toString() // Get password here too

            if (inputEmail.isEmpty()) {
                Toast.makeText(this, "Enter email", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            lifecycleScope.launch {
                try {
                    withContext(Dispatchers.IO) {
                        supabase.auth.signInWith(Email) {
                            // FIX 1: Assign variables correctly
                            email = inputEmail
                            password = inputPassword
                        }
                    }

                    // FIX 2: Use currentSessionOrNull()
                    val session = supabase.auth.currentSessionOrNull()
                    val uid = session?.user?.id ?: ""

                    if (uid.isNotEmpty()) {
                        val sp = getSharedPreferences("vitalink", Context.MODE_PRIVATE)
                        val token = session?.accessToken ?: ""
                        val emailStored = session?.user?.email ?: inputEmail
                        sp.edit()
                            .putString("patientId", uid)
                            .putString("supabaseAccessToken", token)
                            .putString("userEmail", emailStored)
                            .apply()
                        finish()
                    } else {
                        Toast.makeText(this@LoginActivity, "Login failed", Toast.LENGTH_SHORT).show()
                    }
                } catch (e: Exception) {
                    Toast.makeText(this@LoginActivity, "Login error: " + (e.message ?: ""), Toast.LENGTH_SHORT).show()
                }
            }
        }
    }
}