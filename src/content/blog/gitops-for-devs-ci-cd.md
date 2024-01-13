---
title: "GitOps for Devs - Part 03: CI/CD"
description: "In part 03 of the GitOps for Devs article series, we will discuss about CI/CD Implementation."
pubDate: "Dec 31 2023"
heroImage: 'https://bizkt.imgix.net/posts/gitopsfordev/ARGO_CICD_HERO.png'
badge: "New"
---

In the previous article, we discussed the codebase of the Album-App.

|           GitOps for Devs (3 Part Series)            |
|---|
| [GitOps for Devs - Part 01: Installation](./gitops-for-devs-installation) |
| [GitOps for Devs - Part 2: Navigating the Code](./gitops-for-devs-the-code)     |
| [GitOps for Devs - Part 03: CI/CD](./gitops-for-devs-ci-cd)  |

In this article, we will discuss how we can implement CI/CD for the Album-App.

![CI/CD Workflow](https://bizkt.imgix.net/posts/gitopsfordevs/ARGO_CICD.png)

In the previous article, we discussed the codebase of the Album-App. This article will discuss how we can implement CI/CD for the Album-App.

![CI/CD Workflow](https://bizkt.imgix.net/posts/gitopsfordevs/ARGO_CICD.png)

## CI/CD Workflow

There are many ways to implement CI/CD workflow. But in summary,

1. **Testing and Readiness Check**: Once the changes to the application code are thoroughly tested and verified for release, the process can proceed to the release phase.
2. **Triggering the Release Pipeline**: This phase can be initiated manually or through an automated process, depending on your workflow and requirements.
3. **Building and Pushing Docker Images**: The release process involves building the application code and pushing the resulting images to the designated Docker registry or container repository.
4. **Updating Helm Chart Values**: Post-image creation, the Helm chart values in the **configuration repo** need an update with the new Docker image tag.
5. **ArgoCD Trigger and Sync Process**: ArgoCD, being a continuous deployment tool,  detects changes within the configuration repository. ArgoCD compares the desired state (defined in the Git repository) with the actual state of the cluster. Any disparities trigger the synchronization process to ensure alignment between the desired and actual state.
6. **Sync and Deployment**: Upon detecting changes, ArgoCD starts the sync process, pulling the updated configurations from the Git repository. ArgoCD applies these changes to the Kubernetes cluster, managing deployments, updates, or rollbacks as necessary to align the cluster with the desired state defined in the Helm charts.

## The pipeline

The `album-app` 's release pipeline leverages GitHub actions. *The pipeline is implemented in the application repository.*

```yaml
name: Build and Publish Docker Images

on:
  release:
    types:
      - created

env:
  REGISTRY: ghcr.io
  CONFIG_REPO: ${{ github.repository }}-config

jobs:
  build-and-publish:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v2

      - name: Check tag name
        id: check_tag
        run: echo "::set-output name=tag_name::${GITHUB_REF#refs/tags/}"

      - name: Check app name
        id: check_app
        run: |
          app_name=$(echo ${{ steps.check_tag.outputs.tag_name }} | awk -F'-' '{print $1}')
          echo "::set-output name=app_name::$app_name"

      - name: Check Docker Image Version
        id: check_version
        run: |
          version=$(echo ${{ steps.check_tag.outputs.tag_name }} | awk -F'-' '{print $2}')
          echo "::set-output name=version::$version"

      - name: Login to GitHub Packages
        uses: docker/login-action@v1
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GHCR_TOKEN }}

      - name: Build and push frontend or backend image
        id: docker_build
        uses: docker/build-push-action@v2
        with:
          context: ${{ steps.check_app.outputs.app_name }}
          push: true
          tags: ghcr.io/${{ github.repository }}-${{ steps.check_app.outputs.app_name }}:${{ steps.check_version.outputs.version }}
          build-args: |
            VERSION=${{ steps.check_version.outputs.version }}
    outputs:
      version: ${{ steps.check_version.outputs.version }}
      app_name: ${{ steps.check_app.outputs.app_name }}

  deployment:
    needs: build-and-publish
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: read
    # Checkout album-app-config repository
    steps:
      - name: Checkout album-app-config
        uses: actions/checkout@v2
        with:
          repository: ${{ env.CONFIG_REPO }} # Replace with the URL or name of the album-app-config repository
          ref: main
          token: ${{ secrets.CONFIG_REPO_TOKEN }}

        # Step to update album-app-config repository
      - name: Update album-app-config repository
        env:
          GH_TOKEN: ${{ secrets.CONFIG_REPO_TOKEN }}
        run: |
          # Get the release tag and app name
          version='${{ needs.build-and-publish.outputs.version }}'
          app_name='${{ needs.build-and-publish.outputs.app_name }}'

          # Set the release branch name
          release_branch=release/${app_name}_${version}

          # Modify the Helm value file with the new tag
          sed -i.bak "s/tag: \".*\"/tag: \"${version}\"/" ${app_name}/values.yaml

          # Create a new branch
          git config --global user.email ${{ github.actor }}@github.com
          git config --global user.name ${{ github.actor }}
          git checkout -b ${release_branch}

          # Commit changes
          git add ${app_name}/values.yaml
          git commit -m "release: ${app_name} ${version}"

          # Push the changes to the remote repository
          git push origin ${release_branch}

          # Body Content
          pr_body="${{ github.repository }} ${app_name} release ${version}. Please note that this is an automated PR."

          # Title Content
          pr_title="release: ${app_name} ${version}"

          # Open a pull request
          gh pr create --title "${pr_title}" --body "${pr_body}" --base main --head ${release_branch} --repo ${{ env.CONFIG_REPO }}
```

### Triggers

- **Event:** Triggered when a new release is created.

### Environment Variables

- **Registry:** The container registry used (GitHub Container Registry - `ghcr.io`).
- **Config Repository:** Repository used for configuration.

### Jobs

1. **build-and-publish**
   - **Steps:**
     - **Checkout:** Fetches the repository code.
     - **Check tag name:** Extracts the tag name from the release.
     - **Check app name:** Retrieves the application name from the tag.
     - **Check Docker Image Version:** Determines the version of the Docker image.
     - **Login to GitHub Packages:** Authenticates to the GitHub Container Registry.
     - **Build and push image:** Uses Docker Build-Push Action to build and push the Docker image to the registry. It uses the extracted application name and version from earlier steps to tag the image appropriately.

2. **deployment**
   - **Dependencies:** Depends on the completion of the 'build-and-publish' job.
   - **Steps:**
     - **Checkout album-app-config:** Fetches the configuration repository (`CONFIG_REPO`) code.
     - **Update album-app-config repository:**
         - Retrieves the version and app name from the 'build-and-publish' job's outputs.
         - Creates a new release branch with the format `release/${app_name}_${version}`.
         - Modifies a Helm value file in the config repository with the new tag.
         - Commits the changes and pushes them to the remote repository.
         - Creates a pull request with automated content.

Once the pull request has been merged, ArgoCD will detect the changes/disparities and start the sync process.

<!-- {% youtube  <https://youtu.be/6bcoTivOVT4> %} -->

## Sync Policies

You can use ArgoCD sync policies to control the sync behaviour.

Note: By default, changes that are made to the live cluster will not trigger automated sync.

To enable **self-healing**, we might need to include below:

```yaml
spec:
  syncPolicy:
    automated:
      selfHeal: true
```

*By the time you read this article, the `selfHeal` option may or may not be included. See [here](https://github.com/krishanthisera/album-app-config/blob/main/apps/templates/album-app.yaml)*

See the [docs](https://argo-cd.readthedocs.io/en/stable/user-guide/auto_sync/#automated-sync-policy)

### Sync Options

**Sync options** specify how the synchronization should occur, providing additional configurations and parameters for the synchronization process itself.

When using `auto-sync` in Argo CD, it currently applies all objects in an application, causing delays and strain on the API server, but enabling selective sync will only sync resources that are out-of-sync, reducing time and server load for applications with many objects.

```yaml
spec:
  syncPolicy:
    syncOptions:
    - ApplyOutOfSyncOnly=true
```

See the [docs](https://argo-cd.readthedocs.io/en/stable/user-guide/sync-options/)

## Conclusion

Across these articles, we've gone from the basics to some advanced concepts in GitOps using ArgoCD. We started by setting up ArgoCD and deploying a sample app, giving a solid foundation. Then, we dive deep into the code intricacies. Lastly, we explored CI/CD implementation, an essential part of any developer's toolkit.

Hopefully, these pieces have been a practical guide, making GitOps more accessible and showing its potential to streamline development workflows. As we close this series, keep experimenting and leveraging GitOps—it's a game-changer for modern development.

|           GitOps for Devs (3 Part Series)            |
|---|
| [GitOps for Devs - Part 01: Installation](./gitops-for-devs-installation) |
| [GitOps for Devs - Part 2: Navigating the Code](./gitops-for-devs-the-code)     |
| [GitOps for Devs - Part 03: CI/CD](./gitops-for-devs-ci-cd)  |