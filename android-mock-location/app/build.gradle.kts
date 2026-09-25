plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
android {
    namespace = "br.com.radarms.mocklocation"
    compileSdk = 36
    defaultConfig {
        applicationId = "br.com.radarms.mocklocation"
        minSdk = 26
        targetSdk = 36
        versionCode = 1
        versionName = "0.1"
    }
}
