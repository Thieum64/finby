#!/bin/bash
set -euo pipefail

echo "🔧 Installation des prérequis de développement sur macOS..."

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "❌ Homebrew n'est pas installé. Installez-le d'abord : https://brew.sh"
    exit 1
fi

# Update Homebrew
echo "📦 Mise à jour de Homebrew..."
brew update

# Install required packages
echo "🛠️  Installation des outils essentiels..."

# Core development tools
brew_packages=(
    "git"
    "gh"                 # GitHub CLI
    "jq"                 # JSON processor
    "direnv"             # Environment management
    "node@20"            # Node.js LTS
    "pnpm"               # Fast package manager
    "go"                 # Go language
    "terraform"          # Infrastructure as Code
    "google-cloud-sdk"   # GCP CLI
)

for package in "${brew_packages[@]}"; do
    if brew list "$package" &>/dev/null; then
        echo "✅ $package déjà installé"
    else
        echo "⬇️  Installation de $package..."
        brew install "$package"
    fi
done

# Link node@20 as default node
if ! command -v node &> /dev/null; then
    echo "🔗 Configuration de Node.js 20 comme version par défaut..."
    brew link --overwrite node@20
fi

# Configure direnv shell hook
echo "🐚 Configuration de direnv..."
if ! grep -q 'direnv hook' ~/.zshrc 2>/dev/null; then
    echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc
    echo "✅ direnv hook ajouté à ~/.zshrc"
fi

# Verify installations
echo -e "\n🔍 Vérification des versions installées:"
echo "Git: $(git --version)"
echo "GitHub CLI: $(gh --version | head -1)"
echo "jq: $(jq --version)"
echo "direnv: $(direnv --version)"
echo "Node.js: $(node --version)"
echo "pnpm: $(pnpm --version)"
echo "Go: $(go version)"
echo "Terraform: $(terraform --version | head -1)"
echo "gcloud: $(gcloud --version | head -1)"

# Optional Docker setup (commented by default)
echo -e "\n🐳 Configuration Docker (optionnel - décommentez si nécessaire):"
echo "# Pour Docker Desktop:"
echo "# brew install --cask docker"
echo "# Pour Colima (alternative légère):"
echo "# brew install colima docker"
echo "# colima start"

echo -e "\n✅ Installation des prérequis terminée !"
echo "💡 Relancez votre terminal ou exécutez: source ~/.zshrc"