const config = {
  appId: 'com.husseinalmuhanna.nahjalnoor',
  appName: 'نهج النور',
  webDir: 'dist',
  server: {
    cleartext: true,
    allowNavigation: ['*']
  },
  plugins: {
    CapacitorHttp: { enabled: false }
  }
};
export default config;
