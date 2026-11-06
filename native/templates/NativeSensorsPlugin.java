package app.didehban;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** مغناطیس‌سنج خام اندروید (µT) برای ثبت ناهنجاری؛ حدود ۲۰ نمونه در ثانیه */
@CapacitorPlugin(name = "NativeSensors")
public class NativeSensorsPlugin extends Plugin implements SensorEventListener {
    private SensorManager sm;
    private Sensor mag;
    private long lastMs = 0;
    private boolean running = false;

    @PluginMethod
    public void start(PluginCall call) {
        JSObject res = new JSObject();
        if (sm == null) {
            sm = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        }
        mag = (sm == null) ? null : sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD);
        if (mag == null) {
            res.put("available", false);
            call.resolve(res);
            return;
        }
        if (!running) {
            running = sm.registerListener(this, mag, SensorManager.SENSOR_DELAY_GAME);
        }
        res.put("available", running);
        call.resolve(res);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        if (sm != null && running) {
            sm.unregisterListener(this);
        }
        running = false;
        call.resolve();
    }

    @Override
    public void onSensorChanged(SensorEvent e) {
        long now = System.currentTimeMillis();
        if (now - lastMs < 45) return;
        lastMs = now;
        JSObject o = new JSObject();
        o.put("x", (double) e.values[0]);
        o.put("y", (double) e.values[1]);
        o.put("z", (double) e.values[2]);
        notifyListeners("mag", o);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {}
}
