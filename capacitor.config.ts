import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.loanontip.hrms',
  appName: 'Loan On Tip HRMS',
  webDir: 'public',
  server: {
    // Replace this URL with your actual live Vercel production URL
    url: 'https://loanontip-hrms.vercel.app',
    cleartext: true
  }
};

export default config;
