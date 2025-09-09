output "topics" {
  description = "Map of topic names to their full resource names"
  value = {
    requests      = google_pubsub_topic.requests.name
    jobs          = google_pubsub_topic.jobs.name
    notifications = google_pubsub_topic.notifications.name
    dlq           = google_pubsub_topic.dlq.name
  }
}

output "subscriptions" {
  description = "Map of subscription names to their full resource names"
  value = {
    requests_sub      = google_pubsub_subscription.requests_sub.name
    jobs_sub          = google_pubsub_subscription.jobs_sub.name
    notifications_sub = google_pubsub_subscription.notifications_sub.name
    dlq_sub           = google_pubsub_subscription.dlq_sub.name
  }
}

output "topic_ids" {
  description = "Map of topic names to their full resource IDs"
  value = {
    requests      = google_pubsub_topic.requests.id
    jobs          = google_pubsub_topic.jobs.id
    notifications = google_pubsub_topic.notifications.id
    dlq           = google_pubsub_topic.dlq.id
  }
}