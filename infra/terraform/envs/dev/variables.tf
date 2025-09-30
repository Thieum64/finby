variable "project_id" {
  type = string
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "repo_region" {
  type    = string
  default = "europe-west1"
}

variable "svc_authz_image" {
  type = string
}

variable "svc_authz_sa" {
  type = string
}