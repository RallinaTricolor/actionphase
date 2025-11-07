terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Optional: Use Terraform Cloud for state management (free for small teams)
  # backend "remote" {
  #   organization = "your-org"
  #   workspaces {
  #     name = "actionphase-production"
  #   }
  # }

  # Or use S3 backend for state storage
  # backend "s3" {
  #   bucket = "actionphase-terraform-state"
  #   key    = "production/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "ActionPhase"
      Environment = "Production"
      ManagedBy   = "Terraform"
    }
  }
}

# Data source for Ubuntu 24.04 LTS ARM64 AMI
data "aws_ami" "ubuntu_arm64" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# Security group for the EC2 instance
resource "aws_security_group" "actionphase" {
  name        = "actionphase-production"
  description = "Security group for ActionPhase production server"

  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = var.ssh_allowed_ips
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "All outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "actionphase-security-group"
  }
}

# IAM role for EC2 instance (for S3 backup access)
resource "aws_iam_role" "actionphase_ec2" {
  name = "actionphase-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

# IAM policy for S3 backup access
resource "aws_iam_role_policy" "actionphase_s3_backup" {
  name = "actionphase-s3-backup-policy"
  role = aws_iam_role.actionphase_ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation"
        ]
        Resource = aws_s3_bucket.backups.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.backups.arn}/*"
      }
    ]
  })
}

# IAM instance profile
resource "aws_iam_instance_profile" "actionphase" {
  name = "actionphase-instance-profile"
  role = aws_iam_role.actionphase_ec2.name
}

# S3 bucket for database backups
resource "aws_s3_bucket" "backups" {
  bucket = var.s3_backup_bucket

  tags = {
    Name = "ActionPhase Backups"
  }
}

# S3 bucket versioning
resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 bucket encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 bucket lifecycle policy
resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "delete-old-backups"
    status = "Enabled"

    expiration {
      days = 30  # Delete after 30 days (no IA transition needed)
    }
  }

  # Note: Transition to STANDARD_IA removed because objects are deleted at 30 days
  # If you want to keep backups longer and save on storage costs, uncomment below:
  #
  # rule {
  #   id     = "transition-to-ia"
  #   status = "Enabled"
  #
  #   transition {
  #     days          = 30
  #     storage_class = "STANDARD_IA"
  #   }
  # }
  #
  # And change expiration above to 90+ days to benefit from IA pricing
}

# EC2 instance
resource "aws_instance" "actionphase" {
  ami           = data.aws_ami.ubuntu_arm64.id
  instance_type = var.instance_type

  vpc_security_group_ids = [aws_security_group.actionphase.id]
  iam_instance_profile   = aws_iam_instance_profile.actionphase.name

  root_block_device {
    volume_type = "gp3"
    volume_size = var.root_volume_size
    encrypted   = true

    tags = {
      Name = "actionphase-root-volume"
    }
  }

  # User data script for initial setup
  user_data = templatefile("${path.module}/user-data.sh", {
    github_repo   = var.github_repo
    domain        = var.domain
    admin_email   = var.admin_email
  })

  # Enable EC2 instance auto-recovery
  maintenance_options {
    auto_recovery = "default"
  }

  tags = {
    Name = "actionphase-production"
  }
}

# Elastic IP
resource "aws_eip" "actionphase" {
  domain = "vpc"

  tags = {
    Name = "actionphase-elastic-ip"
  }
}

# Associate Elastic IP with instance
resource "aws_eip_association" "actionphase" {
  instance_id   = aws_instance.actionphase.id
  allocation_id = aws_eip.actionphase.id
}

# CloudWatch alarm for instance health
resource "aws_cloudwatch_metric_alarm" "instance_health" {
  alarm_name          = "actionphase-instance-health"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"
  period              = "60"
  statistic           = "Maximum"
  threshold           = "0"
  alarm_description   = "This metric monitors instance health"
  alarm_actions       = var.alarm_email != "" ? [aws_sns_topic.alerts[0].arn] : []

  dimensions = {
    InstanceId = aws_instance.actionphase.id
  }
}

# SNS topic for alerts (optional)
resource "aws_sns_topic" "alerts" {
  count = var.alarm_email != "" ? 1 : 0
  name  = "actionphase-alerts"
}

resource "aws_sns_topic_subscription" "alerts_email" {
  count     = var.alarm_email != "" ? 1 : 0
  topic_arn = aws_sns_topic.alerts[0].arn
  protocol  = "email"
  endpoint  = var.alarm_email
}

# AWS Backup plan for EBS snapshots
resource "aws_backup_plan" "actionphase" {
  name = "actionphase-backup-plan"

  rule {
    rule_name         = "daily-snapshots"
    target_vault_name = aws_backup_vault.actionphase.name
    schedule          = "cron(0 3 * * ? *)" # Daily at 3 AM UTC
    start_window      = 60
    completion_window = 120

    lifecycle {
      delete_after = 7 # Keep for 7 days
    }
  }

  rule {
    rule_name         = "weekly-snapshots"
    target_vault_name = aws_backup_vault.actionphase.name
    schedule          = "cron(0 4 ? * 1 *)" # Weekly on Monday at 4 AM UTC
    start_window      = 60
    completion_window = 120

    lifecycle {
      delete_after = 30 # Keep for 30 days
    }
  }
}

resource "aws_backup_vault" "actionphase" {
  name = "actionphase-backup-vault"
}

resource "aws_backup_selection" "actionphase" {
  iam_role_arn = aws_iam_role.backup.arn
  name         = "actionphase-backup-selection"
  plan_id      = aws_backup_plan.actionphase.id

  resources = [
    aws_instance.actionphase.arn
  ]
}

resource "aws_iam_role" "backup" {
  name = "actionphase-backup-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "backup.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "backup" {
  role       = aws_iam_role.backup.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSBackupServiceRolePolicyForBackup"
}
