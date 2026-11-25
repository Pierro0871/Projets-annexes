import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'fr.pierro.redaction',
  appName: 'Rédaction',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    SystemBars: {
      insetsHandling: 'css',
      initialViewportFitValueHint: 'cover',
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#e4572e',
    },
  },
};

export default config;
