package app.didehban;

import android.Manifest;
import android.content.Context;
import android.media.AudioFormat;
import android.media.AudioManager;
import android.media.AudioRecord;
import android.media.MediaRecorder;
import android.media.audiofx.AcousticEchoCanceler;
import android.media.audiofx.AutomaticGainControl;
import android.media.audiofx.NoiseSuppressor;
import android.os.Build;
import android.os.Process;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/**
 * ضبط خام میکروفون برای پشه‌یاب: AudioRecord با منبع UNPROCESSED، استریو در صورت امکان،
 * بدون AGC/NS/AEC. نمونه‌ها به‌صورت PCM ۱۶بیتی درهم‌آمیخته (L,R,L,R…) و Base64 به جاوااسکریپت می‌رسند.
 * نگهبان: اگر ۶ ثانیه ping نیاید (صفحه متوقف یا برنامه در پس‌زمینه)، میکروفون خودکار آزاد می‌شود.
 */
@CapacitorPlugin(
    name = "NativeAudio",
    permissions = { @Permission(strings = { Manifest.permission.RECORD_AUDIO }, alias = "microphone") }
)
public class NativeAudioPlugin extends Plugin {
    private static final int SRC_UNPROCESSED = 9; // MediaRecorder.AudioSource.UNPROCESSED (API 24)
    private static final int FRAMES = 2048;       // فریم در هر بسته (۴۲ms در ۴۸kHz)

    private AudioRecord rec;
    private Thread worker;
    private volatile boolean running = false;
    private volatile long lastPing = 0;
    private AutomaticGainControl agc;
    private NoiseSuppressor ns;
    private AcousticEchoCanceler aec;

    @PluginMethod
    public void info(PluginCall call) {
        JSObject o = new JSObject();
        o.put("unprocessed", unprocessedSupported());
        o.put("api", Build.VERSION.SDK_INT);
        call.resolve(o);
    }

    @PluginMethod
    public void ping(PluginCall call) {
        lastPing = System.currentTimeMillis();
        call.resolve();
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (getPermissionState("microphone") != PermissionState.GRANTED) {
            requestPermissionForAlias("microphone", call, "micPermResult");
            return;
        }
        doStart(call);
    }

    @PermissionCallback
    private void micPermResult(PluginCall call) {
        if (getPermissionState("microphone") == PermissionState.GRANTED) {
            doStart(call);
        } else {
            call.reject("اجازه‌ی میکروفون داده نشد");
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopInternal();
        call.resolve();
    }

    private boolean unprocessedSupported() {
        if (Build.VERSION.SDK_INT < 24) return false;
        try {
            AudioManager am = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
            return "true".equals(am.getProperty(AudioManager.PROPERTY_SUPPORT_AUDIO_SOURCE_UNPROCESSED));
        } catch (Throwable t) {
            return false;
        }
    }

    /** ترتیب امتحان منبع‌ها بر اساس انتخاب کاربر */
    private int[] sourceOrder(String pref) {
        boolean un = unprocessedSupported();
        int unp = un ? SRC_UNPROCESSED : MediaRecorder.AudioSource.VOICE_RECOGNITION;
        if ("unprocessed".equals(pref)) return new int[] { unp, MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC };
        if ("camcorder".equals(pref)) return new int[] { MediaRecorder.AudioSource.CAMCORDER, unp, MediaRecorder.AudioSource.VOICE_RECOGNITION };
        if ("recognition".equals(pref)) return new int[] { MediaRecorder.AudioSource.VOICE_RECOGNITION, unp, MediaRecorder.AudioSource.MIC };
        return new int[] { unp, MediaRecorder.AudioSource.CAMCORDER, MediaRecorder.AudioSource.VOICE_RECOGNITION, MediaRecorder.AudioSource.MIC };
    }

    private String sourceName(int src) {
        if (src == SRC_UNPROCESSED) return "UNPROCESSED";
        if (src == MediaRecorder.AudioSource.CAMCORDER) return "CAMCORDER";
        if (src == MediaRecorder.AudioSource.VOICE_RECOGNITION) return "VOICE_RECOGNITION";
        return "MIC";
    }

    private AudioRecord tryRecord(int src, int sr, int chCfg) {
        try {
            int min = AudioRecord.getMinBufferSize(sr, chCfg, AudioFormat.ENCODING_PCM_16BIT);
            if (min <= 0) return null;
            int chs = (chCfg == AudioFormat.CHANNEL_IN_STEREO) ? 2 : 1;
            int buf = Math.max(min, FRAMES * chs * 2 * 4);
            AudioRecord r = new AudioRecord(src, sr, chCfg, AudioFormat.ENCODING_PCM_16BIT, buf);
            if (r.getState() != AudioRecord.STATE_INITIALIZED) {
                r.release();
                return null;
            }
            return r;
        } catch (Throwable t) {
            return null;
        }
    }

    private String disableEffects(AudioRecord r) {
        StringBuilder sb = new StringBuilder();
        int id = r.getAudioSessionId();
        try {
            if (AutomaticGainControl.isAvailable()) {
                agc = AutomaticGainControl.create(id);
                if (agc != null) { agc.setEnabled(false); sb.append("AGC خاموش "); }
            }
        } catch (Throwable ignored) {}
        try {
            if (NoiseSuppressor.isAvailable()) {
                ns = NoiseSuppressor.create(id);
                if (ns != null) { ns.setEnabled(false); sb.append("حذف نوفه خاموش "); }
            }
        } catch (Throwable ignored) {}
        try {
            if (AcousticEchoCanceler.isAvailable()) {
                aec = AcousticEchoCanceler.create(id);
                if (aec != null) { aec.setEnabled(false); sb.append("حذف پژواک خاموش"); }
            }
        } catch (Throwable ignored) {}
        return sb.toString().trim();
    }

    private void doStart(PluginCall call) {
        stopInternal();
        int sr = call.getInt("sampleRate", 48000);
        boolean wantStereo = call.getBoolean("stereo", true);
        String pref = call.getString("source", "auto");
        int[] order = sourceOrder(pref);

        AudioRecord r = null;
        int used = -1;
        int channels = 1;
        if (wantStereo) {
            for (int src : order) {
                r = tryRecord(src, sr, AudioFormat.CHANNEL_IN_STEREO);
                if (r != null) { used = src; channels = 2; break; }
            }
        }
        if (r == null) {
            for (int src : order) {
                r = tryRecord(src, sr, AudioFormat.CHANNEL_IN_MONO);
                if (r != null) { used = src; channels = 1; break; }
            }
        }
        if (r == null) {
            call.reject("میکروفون باز نشد");
            return;
        }

        rec = r;
        final int ch = channels;
        String effects = disableEffects(r);
        try {
            r.startRecording();
        } catch (Throwable t) {
            stopInternal();
            call.reject("شروع ضبط ممکن نشد");
            return;
        }
        if (r.getRecordingState() != AudioRecord.RECORDSTATE_RECORDING) {
            stopInternal();
            call.reject("میکروفون در اختیار برنامه‌ی دیگری است");
            return;
        }

        running = true;
        lastPing = System.currentTimeMillis();
        final AudioRecord rr = r;
        worker = new Thread(new Runnable() {
            @Override
            public void run() {
                try { Process.setThreadPriority(Process.THREAD_PRIORITY_URGENT_AUDIO); } catch (Throwable ignored) {}
                short[] sh = new short[FRAMES * ch];
                byte[] bytes = new byte[sh.length * 2];
                long seq = 0;
                while (running) {
                    if (System.currentTimeMillis() - lastPing > 6000) {
                        running = false;
                        JSObject s = new JSObject();
                        s.put("reason", "watchdog");
                        notifyListeners("stopped", s);
                        break;
                    }
                    int n = rr.read(sh, 0, sh.length);
                    if (n <= 0) {
                        if (n < 0) {
                            running = false;
                            JSObject s = new JSObject();
                            s.put("reason", "read-error");
                            notifyListeners("stopped", s);
                        }
                        continue;
                    }
                    for (int i = 0; i < n; i++) {
                        bytes[2 * i] = (byte) (sh[i] & 0xff);
                        bytes[2 * i + 1] = (byte) ((sh[i] >> 8) & 0xff);
                    }
                    JSObject o = new JSObject();
                    o.put("seq", seq++);
                    o.put("n", n);
                    o.put("data", Base64.encodeToString(bytes, 0, n * 2, Base64.NO_WRAP));
                    notifyListeners("pcm", o);
                }
                releaseRecorder();
            }
        }, "didehban-audio");
        worker.start();

        JSObject res = new JSObject();
        res.put("sampleRate", r.getSampleRate());
        res.put("channels", channels);
        res.put("source", sourceName(used));
        res.put("unprocessed", used == SRC_UNPROCESSED);
        res.put("effects", effects);
        call.resolve(res);
    }

    private synchronized void releaseRecorder() {
        try { if (agc != null) { agc.release(); agc = null; } } catch (Throwable ignored) {}
        try { if (ns != null) { ns.release(); ns = null; } } catch (Throwable ignored) {}
        try { if (aec != null) { aec.release(); aec = null; } } catch (Throwable ignored) {}
        AudioRecord r = rec;
        rec = null;
        if (r != null) {
            try { r.stop(); } catch (Throwable ignored) {}
            try { r.release(); } catch (Throwable ignored) {}
        }
    }

    private void stopInternal() {
        running = false;
        Thread w = worker;
        worker = null;
        if (w != null) {
            try { w.join(500); } catch (InterruptedException ignored) {}
        }
        releaseRecorder();
    }
}
