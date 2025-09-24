module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [2, "always", [
      "infra","svc-authz","svc-shops","svc-requests","svc-jobs","svc-ia-diff","svc-quality","svc-preview","svc-billing","svc-notify","svc-admin","web","data","security","compliance","ops","docs","contract-tests","e2e"
    ]]
  }
}