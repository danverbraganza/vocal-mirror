import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

export default defineConfig({
  plugins: [react(), mkcert()],
  server: {
    https: true,
    host: true, // Allow external connections
    port: 3000
  },
  build: {
    outDir: 'dist',
	rollupOptions: {
	  input: {
		"vocal-mirror": 'index.html',
	  },
	  output: {
     	  "entryFileNames": 'assets/[name].js',
		  "assetFileNames": 'assets/[name].[ext]',
	  }
	}
  }
});
