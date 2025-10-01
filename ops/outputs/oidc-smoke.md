# OIDC Auth Smoke Test - GitHub → GCP

## Variables utilisées

```bash
PROJECT_ID="hyperush-dev-250930115246"
PROJECT_NUMBER="443512026283"
REGION="europe-west1"
WIF_POOL_ID="github-pool"
WIF_PROVIDER_ID="github-provider"
GITHUB_REPO="hyperush-org/hyperush"
DEPLOY_SA="deploy-sa@hyperush-dev-250930115246.iam.gserviceaccount.com"
WORKLOAD_IDENTITY_PROVIDER="projects/443512026283/locations/global/workloadIdentityPools/github-pool/providers/github-provider"
```

## Comment lancer le workflow

1. Aller sur GitHub: https://github.com/hyperush-org/hyperush
2. Cliquer sur l'onglet **Actions**
3. Dans la liste des workflows, sélectionner **"OIDC Auth Smoke (GCP)"**
4. Cliquer sur **"Run workflow"**
5. Sélectionner la branche `ci/oidc-smoke` ou `main`
6. Cliquer sur **"Run workflow"**

Ou bien:

- Le workflow se déclenche automatiquement lors d'un push sur `main` si le fichier `.github/workflows/oidc-auth-smoke.yml` est modifié

## Résultat attendu

Le workflow doit s'exécuter avec succès et afficher dans les logs:

### Show gcloud identity

```
Credentialed Accounts
ACTIVE: deploy-sa@hyperush-dev-250930115246.iam.gserviceaccount.com
```

### Project access check

```
443512026283
Listed 0 items. (ou liste des services Cloud Run)
Listed 0 items. (ou liste des repositories Artifact Registry)
```

### STS sanity

```
deploy-sa@hyperush-dev-250930115246.iam.gserviceaccount.com
```

## Vérifications

✅ `gcloud projects describe` renvoie le projectNumber `443512026283`
✅ `gcloud run services list` sort sans "permission denied"
✅ L'identité active est le SA: `deploy-sa@hyperush-dev-250930115246.iam.gserviceaccount.com`
✅ `gcloud iam service-accounts describe` réussit avec le SA deploy

Si toutes ces vérifications passent, l'authentification OIDC GitHub→GCP via Workload Identity Federation fonctionne correctement.
