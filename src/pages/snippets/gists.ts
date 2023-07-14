import axios from 'axios';

// GitHub username
const username = 'your_username';

// GitHub API endpoint for fetching user's Gists
const GISTS_API_ENDPOINT = `https://api.github.com/users/${username}/gists`;

// Function to fetch user's Gists
async function fetchGists(): Promise<any[]> {
  try {
    const response = await axios.get(GISTS_API_ENDPOINT);
    return response.data;
  } catch (error) {
    console.error(`Failed to fetch Gists: ${error}`);
    return [];
  }
}


// Function to generate HTML for displaying Gists
export function generateGistsHTML(gists: any[]): string {
    const html = `
      <html>
        <head>
          <title>My GitHub Gists</title>
        </head>
        <body>
          <h1>My GitHub Gists</h1>
          <ul>
            ${gists
              .map(
                (gist) => `
                  <li>
                    <h3>${gist.description || 'Untitled'}</h3>
                    <p>${gist.created_at}</p>
                    <ul>
                      ${Object.values(gist.files)
                        .map(
                          (file: any) => `
                            <li>
                              <a href="${file.raw_url}">${file.filename}</a>
                            </li>
                          `
                        )
                        .join('')}
                    </ul>
                  </li>
                `
              )
              .join('')}
          </ul>
        </body>
      </html>
    `;
    return html;
  }