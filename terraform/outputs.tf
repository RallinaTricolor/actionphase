output "instance_id" {
  description = "ID of the EC2 instance"
  value       = aws_instance.actionphase.id
}

output "public_ip" {
  description = "Public IP address of the instance"
  value       = aws_eip.actionphase.public_ip
}

output "public_dns" {
  description = "Public DNS of the instance"
  value       = aws_eip.actionphase.public_dns
}

output "s3_backup_bucket" {
  description = "Name of the S3 backup bucket"
  value       = aws_s3_bucket.backups.id
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh ubuntu@${aws_eip.actionphase.public_ip}"
}

output "application_url" {
  description = "URL to access the application"
  value       = "https://${var.domain}"
}

output "deployment_instructions" {
  description = "Next steps after Terraform apply"
  value       = <<-EOT
    ========================================
    ActionPhase Infrastructure Created!
    ========================================

    1. Update DNS:
       Point ${var.domain} to ${aws_eip.actionphase.public_ip}

    2. SSH to server:
       ${local.ssh_command}

    3. Check Docker installation:
       docker --version
       docker-compose --version

    4. Clone and deploy application:
       cd /opt/actionphase
       git pull origin main
       ./docker-setup.sh

    5. Set up SSL certificate:
       ./scripts/setup-ssl.sh ${var.domain}

    6. Verify deployment:
       curl http://localhost:3000/ping
       docker-compose ps

    For detailed instructions, see:
    .claude/planning/PRODUCTION_DEPLOYMENT.md
    ========================================
  EOT
}

locals {
  ssh_command = "ssh ubuntu@${aws_eip.actionphase.public_ip}"
}
