variable "name" {
  type = string
}

variable "retention" {
  type    = string
  default = "604800s"
}

variable "labels" {
  type    = map(string)
  default = {}
}