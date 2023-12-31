---
title: "GitOps for Devs - Part 02: Navigating the Code"
description: "In the part 02 of the GitOps for Devs article series, we will dive deeper into the code."
pubDate: "Dec 31 2023"
heroImage: 'https://bizkt.imgix.net/posts/gitopsfordevs/GitOps-for-devs-code.jpeg'
badge: "New"
---
We're continuing our exploration of GitOps with ArgoCD. In the first part, we got a grasp of GitOps basics and set up an example app called Album-App. Now, let's explore the repositories that drive this application:

## The Two Repositories

1. **Application Code** - This contains the actual code for both the Frontend and Backend applications.
    - **Backend**: A simple REST API written in Go, accessible on port 8080.
    - **Frontend**: A React application that communicates with the backend.
2. **Config Repo** - Hosts Helm charts defining the application's infrastructure.

## Application Repository

The application repository contains the code for both Frontend and Backend applications.

### Backend

The backend application itself is a simple REST API written in Go.

The application exposes port `8080`.

You can test the application on your docker environment by,

```bash
docker run -p 8080:8080 ghcr.io/krishanthisera/album-app-backend
```

Once the container is up click [here](http://localhost:8080/docs/index.html) to see API documentation.

### Frontend

The Frontend is a React application that talks to the backend.

To test the application locally,

```bash
docker run -p 3000:3000 ghcr.io/krishanthisera/album-app-frontend
```

_Please note that the backend app should be running on port 8080._

## Configuration Repository

The [Config Repo](https://github.com/krishanthisera/album-app-config) contains Helm charts that define the application infrastructure.

![Helm Charts](https://bizkt.imgix.net/posts/gitopsfordevs/ARGO_HELM_CHARTS.png)

Here we have four helm charts ⎈,

1. `root-app`: Acts as ArgoCD's entry point, managing and deploying the whole application stack.
2. `apps`: Contains ArgoCD applications.
3. `frontend and backend`: Helm charts for respective Kubernetes deployments.

### Understanding Root App

As the name suggests, the `root app` is the entry point for ArgoCD to manage and deploy the entire application stack.

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: root-app
  namespace: argocd
  finalizers:
  - resources-finalizer.argocd.argoproj.io
spec:
  destination:
    namespace: album-app
    name: in-cluster
  project: default
  source:
    path: apps
    repoURL: https://github.com/krishanthisera/album-app-config
    targetRevision: HEAD
```

![Root App](https://bizkt.imgix.net/posts/gitopsfordevs/ARGO_ROOT-APP.png)

Here's a snippet:

- **Destination:** Specifies where the application will be deployed (namespace and cluster).
- **Project:** Defines the ArgoCD project the application belongs to. Projects offer a way to group and organize applications based on shared policies, permissions, and settings.

    ```yaml
    # Default ArgoCD Project
    apiVersion: argoproj.io/v1alpha1
    kind: AppProject
    metadata:
      name: default  # Name of the project
      namespace: argocd  # Namespace where the project resides
    spec:
      clusterResourceWhitelist:  # Whitelisted cluster resources
      - group: '*'  # All resource groups allowed
        kind: '*'   # All resource kinds allowed
      destinations:  # Deployment destinations
      - namespace: '*'  # Deploy to all namespaces
        server: '*'  # Deploy to all servers
      sourceRepos:  # Allowed source repositories
      - '*'  # Allow all repositories
    ```

- **Source:** Indicates the source of the application's configuration (Git repository URL, path, and target revision).

Here the `root-app` points to the `/apps` directory in the config repo.

## Apps Helm Chart

As mentioned in the previous article, here we follow the ArgoCD App-of-Apps pattern.

![Apps of Apps](https://bizkt.imgix.net/posts/gitopsdevs/ARGO_APPS_OF_APPS.png)

Above are ArgoCD application resources residing in the argocd namespace. They define their respective apps' deployment targets, projects, and source repositories.

```yaml
# Backend Application
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: album-app-backend  # Name of the ArgoCD application
  namespace: argocd  # Namespace where the ArgoCD application resides
  finalizers:
    - resources-finalizer.argocd.argoproj.io  # Action to be taken when deleting the resource
spec:
  destination:
    namespace: album-app  # Deployment target namespace for the backend application
    server: https://kubernetes.default.svc  # Kubernetes server for deployment
  project: album-app  # Project to which the backend application belongs
  source:
    path: backend  # Directory containing backend code/configuration
    repoURL: https://github.com/krishanthisera/album-app-config  # Git repository URL
    targetRevision: HEAD  # Target revision of the repository

---
# Frontend Application
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: album-app-frontend  # Name of the ArgoCD application
  namespace: argocd  # Namespace where the ArgoCD application resides
  finalizers:
    - resources-finalizer.argocd.argoproj.io  # Action to be taken when deleting the resource
spec:
  destination:
    namespace: album-app  # Deployment target namespace for the frontend application
    server: https://kubernetes.default.svc  # Kubernetes server for deployment
  project: album-app  # Project to which the frontend application belongs
  source:
    path: frontend  # Directory containing frontend code/configuration
    repoURL: https://github.com/krishanthisera/album-app-config  # Git repository URL
    targetRevision: HEAD  # Target revision of the repository
```

![Apps of Apps](https://bizkt.imgix.net/posts/gitopsfordevs/ARGO_ALBUM-APPS.png)

_If you follow the repo, the helm template creates the namespace and the ArgoCD project._

**Note:** If you want to ensure that child apps and all of their resources are deleted when the parent app is deleted, it's essential to add the appropriate finalizer to your Application definition. This finalizer action ensures proper cleanup and deletion of all related resources when the parent application is removed. See [here](https://argo-cd.readthedocs.io/en/stable/user-guide/app_deletion/)

I have included all the ArgoCD applications this repo intended to deploy.

The frontend and backend ArgoCD Application resources point to their respective directory in the repository.

## Frontend and Backend Helm Charts

These Helm charts define how the frontend and backend applications will be deployed on Kubernetes. They contain configuration details encapsulated within `values.yaml` files.

```yaml
replicaCount: 1
namespace: album-app
image:
  repository: ghcr.io/krishanthisera/album-app-backend
  pullPolicy: IfNotPresent
  tag: "v1.3.2" # Important: This tag signifies the version of the backend application.
  containerPort: 8080


service: 
  name: album-app-backend
  port: 8080
```

![Backend Resources](https://bizkt.imgix.net/posts/gitopsfordevs/ARGO_ALBUM-APP_BE.png)

The value files are pretty straightforward. The only thing to note is the `tag` value. It is the image tag of the backend application.

During the release process of the application, the `tag` value will be replaced with the respective image tag.

Part 3 of the article series will cover the release process including CI/CD pipelines.

Stay tuned!
