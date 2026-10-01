terraform {
  backend "gcs" {
    prefix = "banking/dev/07-edge"
  }
}
