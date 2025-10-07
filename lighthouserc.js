module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      startServerCommand: "pnpm start",
      startServerReadyPattern: "ready - started server",
      startServerReadyTimeout: 120000,
      url: ["http://localhost:3000"],
      settings: {
        disableStorageReset: true,
      },
    },
    assert: {
      preset: "lighthouse:no-pwa",
      assertions: {
        "categories:performance": ["warn", { minScore: 0.8 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: "reports/lighthouse",
    },
  },
};
