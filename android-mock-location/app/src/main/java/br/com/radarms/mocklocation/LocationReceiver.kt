package br.com.radarms.mocklocation

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationManager
import android.location.provider.ProviderProperties
import android.os.Build
import android.os.SystemClock

class LocationReceiver: BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val lat = intent.getStringExtra("lat")?.toDoubleOrNull() ?: return
        val lon = intent.getStringExtra("lon")?.toDoubleOrNull() ?: return
        val alt = intent.getStringExtra("alt")?.toDoubleOrNull() ?: 520.0
        val lm = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
        val provider = LocationManager.GPS_PROVIDER

        try { lm.removeTestProvider(provider) } catch (_: Exception) {}

        try {
            if (Build.VERSION.SDK_INT >= 31) {
                val props = ProviderProperties.Builder()
                    .setAccuracy(ProviderProperties.ACCURACY_FINE)
                    .setPowerUsage(ProviderProperties.POWER_USAGE_LOW)
                    .setHasAltitudeSupport(true)
                    .setHasSpeedSupport(true)
                    .setHasBearingSupport(true)
                    .build()
                lm.addTestProvider(provider, props)
            } else {
                @Suppress("DEPRECATION")
                lm.addTestProvider(provider, false, false, false, false, true, true, true, 0, 5)
            }
        } catch (_: Exception) {}

        try { lm.setTestProviderEnabled(provider, true) } catch (_: Exception) {}

        val l = Location(provider).apply {
            latitude = lat
            longitude = lon
            altitude = alt
            accuracy = 3f
            time = System.currentTimeMillis()
            elapsedRealtimeNanos = SystemClock.elapsedRealtimeNanos()
        }

        try { lm.setTestProviderLocation(provider, l) } catch (_: Exception) {}
    }
}
