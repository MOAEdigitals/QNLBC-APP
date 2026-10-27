package com.qnlbc.churchapp;

import com.getcapacitor.BridgeActivity;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel("church-alerts-v2", "Church notifications", NotificationManager.IMPORTANCE_HIGH);
      channel.setDescription("Assignments, announcements, birthdays and special events");
      channel.enableVibration(true);
      channel.setSound(Uri.parse("android.resource://" + getPackageName() + "/raw/qnlbc_notification"), new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_NOTIFICATION).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
      getSystemService(NotificationManager.class).createNotificationChannel(channel);
    }
  }
}
