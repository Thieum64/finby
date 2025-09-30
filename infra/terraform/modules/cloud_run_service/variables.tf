variable "name" {
  type = string
}

variable "region" {
  type = string
}

variable "image" {
  type = string
}

variable "service_account_email" {
  type = string
}

variable "min_instances" {
  type    = number
  default = 0
}

variable "max_instances" {
  type    = number
  default = 3
}

variable "cpu" {
  type    = string
  default = "1"
}

variable "memory" {
  type    = string
  default = "512Mi"
}

variable "env" {
  type    = map(string)
  default = {}
}

variable "ingress" {
  type    = string
  default = "INGRESS_TRAFFIC_ALL"
}