output "instance_id" {
  description = "EC2 instance ID"
  value       = aws_instance.rala_api.id
}

output "public_ip" {
  description = "Elastic IP address of the instance"
  value       = aws_eip.rala_api.public_ip
}

output "public_dns" {
  description = "Public DNS name of the instance"
  value       = aws_instance.rala_api.public_dns
}

output "api_url" {
  description = "URL to access the API"
  value       = "http://${aws_eip.rala_api.public_ip}:3000"
}

output "api_swagger_url" {
  description = "URL to access the API Swagger documentation"
  value       = "http://${aws_eip.rala_api.public_ip}:3000/api"
}

output "grafana_url" {
  description = "URL to access Grafana dashboard (DISABLED - monitoring stack disabled for t3.micro)"
  value       = "Monitoring disabled to save memory on t3.micro"
}

output "prometheus_url" {
  description = "URL to access Prometheus (DISABLED - monitoring stack disabled for t3.micro)"
  value       = "Monitoring disabled to save memory on t3.micro"
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i <your-key.pem> ec2-user@${aws_eip.rala_api.public_ip}"
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.rala_api.id
}

output "data_volume_id" {
  description = "EBS data volume ID"
  value       = aws_ebs_volume.rala_data.id
}

output "quick_access_info" {
  description = "Quick access information for all services"
  value = <<-EOT

    ========================================
    RALA Event Collaboration API - Deployed
    ========================================

    Instance Details:
      Instance ID: ${aws_instance.rala_api.id}
      Public IP:   ${aws_eip.rala_api.public_ip}
      Region:      ${var.aws_region}
      Type:        ${var.instance_type}

    SSH Access:
      ssh -i <your-key.pem> ec2-user@${aws_eip.rala_api.public_ip}

    Application URLs:
      API:        http://${aws_eip.rala_api.public_ip}:3000
      Swagger:    http://${aws_eip.rala_api.public_ip}:3000/api

    NOTE: Monitoring stack (Grafana/Prometheus) disabled to save memory on t3.micro
          Running only core services: API, PostgreSQL, Redis, Kafka, Zookeeper

    Next Steps:
      1. Wait ~5 minutes for the instance to fully boot and install Docker
      2. SSH into the instance to check deployment status
      3. View logs: sudo journalctl -u cloud-final -f
      4. Check Docker status: docker ps

    ========================================
  EOT
}
