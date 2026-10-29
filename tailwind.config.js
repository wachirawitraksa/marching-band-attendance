/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // semantic status colors — values switch per theme in index.css
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
        info: "hsl(var(--info))",
        holiday: "hsl(var(--holiday))",
        "brand-text": "hsl(var(--brand-text))",
        // brand teal (#17636A)
        brand: {
          DEFAULT: "#17636A",
          "50":  "#edf9fa",
          "100": "#c8edef",
          "200": "#96dce0",
          "300": "#4ab5be",
          "400": "#2a8c95",
          "500": "#17636A",
          "600": "#0E5157",
          "700": "#0D3F46",
          "800": "#0a2e34",
          "900": "#071f24",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out",
      },
      fontFamily: {
        // ฟอนต์ไทยของระบบเป็น fallback ระหว่างรอ Noto Sans Thai (Noto Sans ธรรมดาไม่มีอักษรไทย)
        sans: ["Noto Sans Thai", "Leelawadee UI", "Thonburi", "system-ui", "sans-serif"],
      },
      // ระยะบรรทัดปรับสำหรับภาษาไทย: สระบน/ล่างและวรรณยุกต์สูง ค่า default ของ Tailwind (1.43 ที่ text-sm) แน่นเกินไป
      fontSize: {
        xs:   ["0.75rem",  { lineHeight: "1.125rem" }],
        sm:   ["0.875rem", { lineHeight: "1.375rem" }],
        base: ["1rem",     { lineHeight: "1.625rem" }],
        lg:   ["1.125rem", { lineHeight: "1.75rem" }],
        xl:   ["1.25rem",  { lineHeight: "1.875rem" }],
        "2xl": ["1.5rem",  { lineHeight: "2.125rem" }],
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
    // touch/stylus primary input → larger hit areas without bloating desktop
    function ({ addVariant }) { addVariant("coarse", "@media (pointer: coarse)"); },
  ],
}
