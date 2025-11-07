variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type (ARM-based for cost savings)"
  type        = string
  default     = "t4g.small"
}

variable "root_volume_size" {
  description = "Size of the root EBS volume in GB"
  type        = number
  default     = 30
}

variable "ssh_allowed_ips" {
  description = "List of IP addresses allowed to SSH to the instance"
  type        = list(string)
  default     = ["0.0.0.0/0"] # Change this to your IP for better security
}

variable "s3_backup_bucket" {
  description = "S3 bucket name for database backups"
  type        = string
  default     = "actionphase-backups"
}

variable "github_repo" {
  description = "GitHub repository URL for ActionPhase"
  type        = string
  default     = "https://github.com/yourusername/actionphase.git"
}

variable "domain" {
  description = "Domain name for the application"
  type        = string
  default     = "actionphase.com"
}

variable "admin_email" {
  description = "Admin email for Let's Encrypt and alerts"
  type        = string
  default     = "admin@example.com"
}

variable "alarm_email" {
  description = "Email address for CloudWatch alarms (leave empty to disable)"
  type        = string
  default     = ""
}
