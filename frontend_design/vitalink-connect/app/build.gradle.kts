import java.util.Properties
plugins {
    id("com.android.application") version "8.9.1"
    
    // Update Kotlin to 2.1.20
    kotlin("android") version "2.1.20"
    kotlin("plugin.serialization") version "2.1.20"
    
    // Update KSP to the matching 2.1.20 version
    id("com.google.devtools.ksp") version "2.1.20-1.0.31"
}

android {
    namespace = "com.vitalink.connect"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.vitalink.connect"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        val props = Properties()
        val lp = rootProject.file("local.properties")
        if (lp.exists()) lp.inputStream().use { props.load(it) }
        buildConfigField("String", "SUPABASE_URL", "\"${props.getProperty("SUPABASE_URL", "")}\"")
        buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", "\"${props.getProperty("SUPABASE_PUBLISHABLE_KEY", "")}\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.2")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
    implementation("androidx.health.connect:connect-client:1.2.0-alpha02")
    implementation("androidx.room:room-runtime:2.6.1")
    implementation("androidx.room:room-ktx:2.6.1")
    ksp("androidx.room:room-compiler:2.6.1")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")
    implementation(platform("io.github.jan-tennert.supabase:bom:3.1.3"))
    implementation("io.github.jan-tennert.supabase:auth-kt")
    implementation("io.ktor:ktor-client-android:3.0.0")
}