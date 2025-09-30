terraform {
  backend "gcs" {
    bucket = "hp-dev-tfstate"
    prefix = "terraform/state"
  }
}