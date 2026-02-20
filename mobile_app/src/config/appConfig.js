// NOTE: when running the dev-client on a physical device, using "auto"
// to resolve the host can sometimes fail. Set this to your machine IP
// and port where the backend is listening (example: http://10.0.0.65:8001)
// so the mobile app can reach the local backend while testing.
const appConfig = {
    // Set to "auto" to auto-discover (default) or to an explicit URL
    // e.g. "http://10.0.0.65:8001". Overriding here avoids missing
    // packets when using tunnels / dev-client.
    apiBaseUrl: "http://10.0.0.65:8001",
    meetingMaterials: {
        maxItems: 10,
        maxTotalMb: 100
    }
};

export default appConfig;
