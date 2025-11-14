package com.vitalink.connect;

@kotlin.Metadata(mv = {1, 9, 0}, k = 1, xi = 48, d1 = {"\u0000J\n\u0002\u0018\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0010\u000e\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0018\u0002\n\u0002\b\u0003\n\u0002\u0010\"\n\u0000\n\u0002\u0018\u0002\n\u0000\n\u0002\u0010\u0002\n\u0000\n\u0002\u0010\u000b\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0002\n\u0002\u0018\u0002\n\u0002\b\u0005\u0018\u00002\u00020\u0001B\u0005\u00a2\u0006\u0002\u0010\u0002J\u0010\u0010\u000f\u001a\u00020\u00102\u0006\u0010\u0011\u001a\u00020\u0012H\u0002J\u0012\u0010\u0013\u001a\u00020\u00102\b\u0010\u0014\u001a\u0004\u0018\u00010\u0015H\u0014J\u0016\u0010\u0016\u001a\u00020\u00102\u0006\u0010\u0017\u001a\u00020\u0018H\u0082@\u00a2\u0006\u0002\u0010\u0019J\u000e\u0010\u001a\u001a\u00020\u0010H\u0082@\u00a2\u0006\u0002\u0010\u001bJ\u000e\u0010\u001c\u001a\u00020\u0010H\u0082@\u00a2\u0006\u0002\u0010\u001bR\u000e\u0010\u0003\u001a\u00020\u0004X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0005\u001a\u00020\u0006X\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\u0007\u001a\u00020\bX\u0082.\u00a2\u0006\u0002\n\u0000R\u000e\u0010\t\u001a\u00020\u0004X\u0082D\u00a2\u0006\u0002\n\u0000R\u000e\u0010\n\u001a\u00020\u0004X\u0082D\u00a2\u0006\u0002\n\u0000R\u0014\u0010\u000b\u001a\b\u0012\u0004\u0012\u00020\u00040\fX\u0082\u0004\u00a2\u0006\u0002\n\u0000R\u001a\u0010\r\u001a\u000e\u0012\n\u0012\b\u0012\u0004\u0012\u00020\u00040\f0\u000eX\u0082\u0004\u00a2\u0006\u0002\n\u0000\u00a8\u0006\u001d"}, d2 = {"Lcom/vitalink/connect/MainActivity;", "Landroidx/appcompat/app/AppCompatActivity;", "()V", "baseUrl", "", "client", "Landroidx/health/connect/client/HealthConnectClient;", "http", "Lokhttp3/OkHttpClient;", "originId", "patientId", "permissions", "", "requestPermissions", "Landroidx/activity/result/ActivityResultLauncher;", "applyPermissionsUI", "", "ok", "", "onCreate", "savedInstanceState", "Landroid/os/Bundle;", "readMetricsAndShow", "txt", "Landroid/widget/TextView;", "(Landroid/widget/TextView;Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "syncTodayToServer", "(Lkotlin/coroutines/Continuation;)Ljava/lang/Object;", "updateOutputWithPermissionStatus", "app_debug"})
public final class MainActivity extends androidx.appcompat.app.AppCompatActivity {
    private androidx.health.connect.client.HealthConnectClient client;
    private okhttp3.OkHttpClient http;
    private java.lang.String baseUrl;
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String patientId = "00000000-0000-0000-0000-000000000001";
    @org.jetbrains.annotations.NotNull()
    private final java.lang.String originId = "android_health_connect";
    @org.jetbrains.annotations.NotNull()
    private final java.util.Set<java.lang.String> permissions = null;
    @org.jetbrains.annotations.NotNull()
    private final androidx.activity.result.ActivityResultLauncher<java.util.Set<java.lang.String>> requestPermissions = null;
    
    public MainActivity() {
        super();
    }
    
    @java.lang.Override()
    protected void onCreate(@org.jetbrains.annotations.Nullable()
    android.os.Bundle savedInstanceState) {
    }
    
    private final java.lang.Object updateOutputWithPermissionStatus(kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
    
    private final void applyPermissionsUI(boolean ok) {
    }
    
    private final java.lang.Object readMetricsAndShow(android.widget.TextView txt, kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
    
    private final java.lang.Object syncTodayToServer(kotlin.coroutines.Continuation<? super kotlin.Unit> $completion) {
        return null;
    }
}