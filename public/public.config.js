window.APP_CONFIG = {
  API_BASE: window.location.origin.includes("5500")
    ? "http://192.168.6.58:5000/api"
    : window.location.origin + "/api",
};
