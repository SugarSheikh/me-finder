import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Hosted at https://sugarsheikh.github.io/me-finder/ — base must match the
// repo path so asset URLs and the BASE_URL data fetch resolve correctly.
export default defineConfig({
  plugins: [react()],
  base: '/me-finder/',
})
