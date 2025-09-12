output "service_url" {
  description = "URL of the deployed Cloud Run service"
  value       = module.service.service_url
}

output "service_name" {
  description = "Name of the deployed Cloud Run service"
  value       = module.service.service_name
}

output "image_used" {
  description = "Container image used for deployment"
  value       = var.image
}