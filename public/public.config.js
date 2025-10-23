window.APP_CONFIG = {
  API_BASE: window.location.origin.includes("5500")
    ? "http://localhost:5000/api" // 👉 ใช้ backend port 5000 ตอนรันผ่าน Live Server
    : window.location.origin + "/api", // 👉 ใช้ port เดียวกันตอนรันผ่าน Node
};
