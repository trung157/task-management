# GitHub Actions CI/CD Pipeline

This repository includes a comprehensive CI/CD pipeline using GitHub Actions for automated testing, building, security scanning, and deployment to multiple cloud platforms.

## Workflows Overview

### 1. CI/CD Pipeline (`ci-cd.yml`)
**Trigger**: Push to `main`/`develop`, Pull Requests
**Features**:
- Automated testing for backend and frontend
- TypeScript compilation and linting
- Docker image building and pushing to GitHub Container Registry
- Security vulnerability scanning with Trivy
- Automated deployment to staging (develop branch) and production (main branch)
- Slack notifications

### 2. Dependency Updates (`dependency-updates.yml`)
**Trigger**: Weekly schedule (Mondays at 2 AM), Manual dispatch
**Features**:
- Automated dependency updates for both backend and frontend
- Security audit with npm audit and Snyk
- Automatic pull request creation for dependency updates
- SARIF upload for security findings

### 3. Performance Testing (`performance.yml`)
**Trigger**: Daily schedule, Push to main, Manual dispatch
**Features**:
- API performance testing with Artillery
- Frontend performance testing with Lighthouse
- Performance regression detection
- Artifact uploads for performance reports

### 4. Multi-Cloud Deployment (`multi-cloud-deploy.yml`)
**Trigger**: Manual dispatch with environment and cloud provider selection
**Features**:
- Deployment to AWS (ECS + S3/CloudFront)
- Deployment to Azure (Container Instances + Static Web Apps)
- Deployment to Google Cloud Platform (Cloud Run)
- Deployment to Docker Swarm
- Post-deployment health checks and smoke tests

### 5. Database Operations (`database-ops.yml`)
**Trigger**: Manual dispatch with operation selection
**Features**:
- Database migrations
- Automated backups to S3
- Database restoration
- Database seeding

## Setup Requirements

### Required Secrets

#### General Secrets
```
GITHUB_TOKEN (automatically provided)
JWT_SECRET
JWT_REFRESH_SECRET
```

#### AWS Secrets
```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_ACCOUNT_ID
AWS_S3_BUCKET_PREFIX
AWS_CLOUDFRONT_DISTRIBUTION_ID
AWS_HEALTH_URL
```

#### Azure Secrets
```
AZURE_CREDENTIALS
AZURE_RG
AZURE_STATIC_WEB_APPS_API_TOKEN
AZURE_DB_HOST
AZURE_DB_USER
AZURE_DB_PASSWORD
AZURE_DB_DATABASE
AZURE_HEALTH_URL
```

#### Google Cloud Platform Secrets
```
GCP_SA_KEY
GCP_PROJECT_ID
GCP_DB_HOST
GCP_DB_USER
GCP_DB_PASSWORD
GCP_DB_DATABASE
GCP_HEALTH_URL
```

#### Docker Swarm Secrets
```
DOCKER_SWARM_SSH_KEY
DOCKER_SWARM_USER
DOCKER_SWARM_HOST
DOCKER_SWARM_HEALTH_URL
```

#### Database Secrets (per environment)
```
DB_HOST
DB_PORT
DB_USER
DB_PASSWORD
DB_DATABASE
BACKUP_S3_BUCKET
```

#### Notification Secrets
```
SLACK_WEBHOOK_URL
SNYK_TOKEN
```

### Environment Setup

#### 1. GitHub Container Registry
The workflows use GitHub Container Registry (ghcr.io) for storing Docker images. Ensure your repository has the necessary permissions.

#### 2. Environment Protection Rules
Set up environment protection rules for `staging` and `production` environments in your repository settings.

#### 3. Branch Protection
Configure branch protection rules for `main` and `develop` branches requiring:
- Status checks to pass
- Pull request reviews
- Up-to-date branches

## Usage Guide

### Automatic Deployments
- **Staging**: Automatically deploys when code is pushed to `develop` branch
- **Production**: Automatically deploys when code is pushed to `main` branch

### Manual Deployments
1. Go to Actions tab in your repository
2. Select "Multi-Cloud Deployment" workflow
3. Click "Run workflow"
4. Choose environment and cloud provider
5. Click "Run workflow"

### Database Operations
1. Go to Actions tab in your repository
2. Select "Database Operations" workflow
3. Click "Run workflow"
4. Choose operation and environment
5. Click "Run workflow"

### Performance Testing
Performance tests run automatically daily, but can be triggered manually:
1. Go to Actions tab
2. Select "Performance Testing" workflow
3. Click "Run workflow"

## Monitoring and Alerts

### Health Checks
All deployments include automated health checks that verify:
- API endpoint availability
- Database connectivity
- Application startup success

### Performance Monitoring
- Lighthouse scores are tracked over time
- API performance metrics are collected
- Regression alerts for performance degradation

### Security Scanning
- Dependency vulnerability scanning
- Container image security scanning
- SARIF reports uploaded to GitHub Security tab

## Customization

### Adding New Cloud Providers
To add support for additional cloud providers:
1. Add new job in `multi-cloud-deploy.yml`
2. Update the cloud provider choice options
3. Add provider-specific secrets
4. Update health check logic

### Custom Performance Tests
Modify the Artillery configuration in `performance.yml` to add:
- New API endpoints
- Different load patterns
- Custom scenarios

### Additional Security Scans
Add new security scanning tools by:
1. Adding steps to existing workflows
2. Configuring tool-specific secrets
3. Setting up SARIF upload for results

## Troubleshooting

### Common Issues

#### 1. Docker Build Failures
- Check Dockerfile syntax
- Verify base image availability
- Review build logs in Actions tab

#### 2. Deployment Failures
- Verify cloud provider credentials
- Check resource quotas and limits
- Review environment-specific secrets

#### 3. Test Failures
- Check test database connectivity
- Verify test environment variables
- Review test logs and coverage reports

#### 4. Performance Test Issues
- Ensure services are properly started
- Check network connectivity
- Verify Artillery configuration

### Getting Help
- Check the Actions tab for detailed logs
- Review the GitHub Actions documentation
- Check cloud provider-specific documentation
- Open an issue in the repository for support

## Best Practices

1. **Secret Management**: Use GitHub Secrets for sensitive data
2. **Environment Isolation**: Keep staging and production separate
3. **Testing**: Ensure comprehensive test coverage before deployment
4. **Monitoring**: Set up proper monitoring and alerting
5. **Rollback**: Have a rollback strategy for failed deployments
6. **Documentation**: Keep deployment documentation up to date
