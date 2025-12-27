#!/bin/bash
set -e

# Log all output to cloud-init-output.log
exec > >(tee /var/log/user-data.log)
exec 2>&1

echo "========================================="
echo "RALA API Deployment - User Data Script"
echo "Started at: $(date)"
echo "========================================="

# Update system
echo "[1/8] Updating system packages..."
dnf update -y

# Install Docker
echo "[2/8] Installing Docker..."
dnf install -y docker git

# Start Docker service
echo "[3/8] Starting Docker service..."
systemctl start docker
systemctl enable docker

# Add ec2-user to docker group
usermod -aG docker ec2-user

# Install Docker Compose
echo "[4/8] Installing Docker Compose..."
DOCKER_COMPOSE_VERSION="v2.24.5"
curl -L "https://github.com/docker/compose/releases/download/$${DOCKER_COMPOSE_VERSION}/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
ln -sf /usr/local/bin/docker-compose /usr/bin/docker-compose

# Set up EBS volume for persistent data
echo "[5/8] Setting up data volume..."
DATA_DEVICE="/dev/xvdf"
DATA_MOUNT="/data"

# Wait for volume to attach
echo "Waiting for EBS volume to attach..."
for i in {1..30}; do
  if [ -e $DATA_DEVICE ]; then
    echo "Volume found!"
    break
  fi
  echo "Waiting for volume... ($i/30)"
  sleep 2
done

# Check if volume has a filesystem, if not create one
if ! blkid $DATA_DEVICE; then
  echo "Creating filesystem on $DATA_DEVICE..."
  mkfs.ext4 $DATA_DEVICE
fi

# Create mount point and mount
mkdir -p $DATA_MOUNT
mount $DATA_DEVICE $DATA_MOUNT

# Add to fstab for persistent mounting
UUID=$(blkid -s UUID -o value $DATA_DEVICE)
if ! grep -q $UUID /etc/fstab; then
  echo "UUID=$UUID $DATA_MOUNT ext4 defaults,nofail 0 2" >> /etc/fstab
fi

# Create directories for Docker volumes (monitoring disabled to save memory)
mkdir -p $DATA_MOUNT/postgres
mkdir -p $DATA_MOUNT/redis

# Set up application
echo "[6/8] Setting up application..."
APP_DIR="/home/ec2-user/event-collaboration-api"

# Clone or pull repository
if [ -d "$APP_DIR" ]; then
  echo "Application directory exists, pulling latest changes..."
  cd $APP_DIR
  git pull origin ${git_branch}
else
  echo "Cloning repository..."
  cd /home/ec2-user
  git clone -b ${git_branch} ${git_repo_url} event-collaboration-api
  cd $APP_DIR
fi

# Set ownership
chown -R ec2-user:ec2-user $APP_DIR
chown -R ec2-user:ec2-user $DATA_MOUNT

# Create production environment file
echo "[7/8] Creating environment configuration..."
cat > $APP_DIR/.env.production <<EOF
NODE_ENV=production
ANTHROPIC_API_KEY=${anthropic_api_key}

# Database
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_USER=rala_user
DATABASE_PASSWORD=rala_password
DATABASE_NAME=event_collaboration

# Redis
REDIS_HOST=redis
REDIS_PORT=6379

# Kafka
KAFKA_BROKERS=kafka:29092
EOF

chown ec2-user:ec2-user $APP_DIR/.env.production

# Create production docker-compose override
# Monitoring stack disabled for t3.micro to save memory
cat > $APP_DIR/docker-compose.prod.yml <<'PRODEOF'
services:
  postgres:
    volumes:
      - /data/postgres:/var/lib/postgresql/data
    restart: always

  redis:
    volumes:
      - /data/redis:/data
    restart: always

  zookeeper:
    restart: always

  kafka:
    restart: always

  api:
    restart: always
    env_file:
      - .env.production
PRODEOF

chown ec2-user:ec2-user $APP_DIR/docker-compose.prod.yml

# Start the application
echo "[8/8] Starting application (monitoring disabled for t3.micro)..."
cd $APP_DIR

# Build the API image
sudo -u ec2-user docker-compose build

# Start all services (monitoring disabled to save memory on t3.micro)
sudo -u ec2-user docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "Waiting for services to start..."
sleep 30

# Show running containers
echo "Running containers:"
docker ps

# Set up log rotation for Docker
cat > /etc/logrotate.d/docker-container <<'LOGEOF'
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=10M
  missingok
  delaycompress
  copytruncate
}
LOGEOF

# Create a startup script for easy management
cat > /home/ec2-user/manage-app.sh <<'MANAGEEOF'
#!/bin/bash
cd /home/ec2-user/event-collaboration-api

case "$1" in
  start)
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
    ;;
  stop)
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
    ;;
  restart)
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart
    ;;
  logs)
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f
    ;;
  status)
    docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|logs|status}"
    exit 1
    ;;
esac
MANAGEEOF

chmod +x /home/ec2-user/manage-app.sh
chown ec2-user:ec2-user /home/ec2-user/manage-app.sh

echo "========================================="
echo "Deployment completed at: $(date)"
echo "========================================="
echo ""
echo "Application is starting up..."
echo "Check status with: docker ps"
echo "View logs with: docker-compose logs -f"
echo "Manage app with: ~/manage-app.sh {start|stop|restart|logs|status}"
