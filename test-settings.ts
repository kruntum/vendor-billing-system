import { describe, expect, test } from "bun:test";

const API_URL = "http://localhost:8801";

const login = async (email, password) => {
    const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });
    return response.json();
};

const getSettings = async (token) => {
    const response = await fetch(`${API_URL}/settings`, {
        method: "GET",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
    });

    console.log("Settings Status:", response.status);
    const text = await response.text();
    console.log("Settings Response:", text);

    return { status: response.status, body: JSON.parse(text) };
};

console.log("--- Starting Test ---");

// 1. Login
console.log("Logging in as vendor...");
const loginRes = await login("vendor@logistics.com", "password123");
console.log("Login Success:", loginRes.success);

if (!loginRes.success) {
    console.error("Login failed:", loginRes);
    process.exit(1);
}

const token = loginRes.data.token;
console.log("Token received:", token ? "Yes" : "No");

// 2. Get Settings
console.log("Fetching settings...");
const settingsRes = await getSettings(token);

if (settingsRes.status === 200) {
    console.log("✅ Settings API works!");
} else {
    console.log("❌ Settings API failed with status", settingsRes.status);
}
