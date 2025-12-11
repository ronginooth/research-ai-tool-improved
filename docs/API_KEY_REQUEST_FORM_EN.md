# Semantic Scholar API Key Request Form Guide (English)

## Access the Form

Visit the [Semantic Scholar API Key Request Form](https://www.semanticscholar.org/product/api#api-key-form).

## Required Information

The form requires the following information:

### 1. **Name**

- Enter your full name
- Example: `Tsukasa Makino`

### 2. **Email Address**

- Email address registered with your Semantic Scholar account
- The API key will be sent to this email address

### 3. **Organization**

- Your organization, university, or company name
- Example: `University of Tokyo` or `Personal Research`

### 4. **Use Case / Purpose**

- Describe the purpose for using the API
- **Recommended description (copy and paste)**:

```
I am developing a research support platform called "Tsukuyomi" that integrates academic paper search, citation, and analysis features. I would like to use the Semantic Scholar API to implement the following functionalities:

Primary use cases:
- Paper search functionality (integration with Semantic Scholar and PubMed)
- Citation network visualization
- Paper metadata retrieval (title, authors, abstract, citation count, etc.)
- Integration with research project management tools

This platform is being developed as an open-source tool for researchers, with the goal of improving the efficiency of academic research. The API will be used to provide users with comprehensive access to scholarly literature and enhance their research workflow.
```

### 5. **Which endpoints do you plan to use?** ⚠️ Required

Specify the endpoints you plan to use. Based on our codebase, we use the following:

**Recommended answer (copy and paste)**:

```
/graph/v1/paper/search
/graph/v1/paper/{paperId}
/graph/v1/paper/{paperId}/citations
/graph/v1/paper/{paperId}/references
/graph/v1/paper/DOI:{doi}
/graph/v1/paper/URL:{url}
```

**Explanation**:

- `/graph/v1/paper/search` - For finding relevant papers based on search queries
- `/graph/v1/paper/{paperId}` - For retrieving detailed paper metadata
- `/graph/v1/paper/{paperId}/citations` - For getting papers that cite a given paper (citation network visualization)
- `/graph/v1/paper/{paperId}/references` - For getting papers referenced by a given paper
- `/graph/v1/paper/DOI:{doi}` - For looking up papers by DOI
- `/graph/v1/paper/URL:{url}` - For looking up papers by URL

### 6. **How many requests per day do you anticipate using?** ⚠️ Required

**Recommended answer (copy and paste)**:

```
500-2000 requests per day

This estimate is based on:
- User search queries: approximately 10-50 searches per day
- Each search may trigger 1-2 API calls to /paper/search
- Citation network visualization: 5-20 papers per session, each requiring 2-3 API calls (paper details, citations, references)
- Paper metadata retrieval: 20-100 papers per day

We will implement rate limiting (1 request per second) and caching to stay within the limit and optimize API usage.
```

### 7. **Checkbox Items**

Check all of the following checkboxes:

- ✅ **I have already successfully made unauthenticated requests**

  - We have successfully tested the API without authentication

- ✅ **I acknowledge that there are only 2 rate plans**

  - We understand there are only 2 rate plans available

- ✅ **I will apply exponential backoff and similar strategies to help protect our systems from overloading**

  - We will implement exponential backoff and rate limiting strategies

- ✅ **I understand that keys that are seen to be inactive for approximately 60 or more days may be removed**

  - We understand that inactive keys may be removed after ~60 days

- ✅ **I have read and agree to Semantic Scholar™ API License Agreement**
  - We agree to the API License Agreement

### 8. **Terms of Service Agreement**

- Check the checkbox to agree to the terms of service

## Example Input

| Field                | Example                                                                                                                                                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**             | Tsukasa Makino                                                                                                                                                                                 |
| **Email Address**    | <your-email@example.com>                                                                                                                                                                       |
| **Organization**     | Personal Research / University Name                                                                                                                                                            |
| **Use Case**         | Use the recommended description above                                                                                                                                                          |
| **Endpoints**        | `/graph/v1/paper/search`, `/graph/v1/paper/{paperId}`, `/graph/v1/paper/{paperId}/citations`, `/graph/v1/paper/{paperId}/references`, `/graph/v1/paper/DOI:{doi}`, `/graph/v1/paper/URL:{url}` |
| **Requests per day** | 500-2000 requests per day (use the recommended answer above)                                                                                                                                   |
| **Checkboxes**       | Check all boxes                                                                                                                                                                                |

## After Submitting the Form

1. **Form Submission**

   - Fill in all information and click the "Submit" button

2. **Approval Waiting Period**

   - The Semantic Scholar team will review your request (usually takes a few days)

3. **Receiving the API Key**

   - After approval, you will receive an email with your API key
   - Email subject: "Your Semantic Scholar API Key Request"
   - The API key will be included in the email body

4. **Setting Up the API Key**
   - Add the received API key to your `.env.local` file
   - See [API_KEY_UPDATE_GUIDE.md](./API_KEY_UPDATE_GUIDE.md) for details

## Important Notes

### ⚠️ Key Points

1. **Email Address Verification**

   - Use the email address registered with your Semantic Scholar account
   - Also check your spam folder

2. **Use Case Description**

   - A specific and clear description increases the likelihood of approval
   - If it's for commercial use, clearly state that

3. **API Key Management**

   - API keys are confidential. Do not share them with anyone
   - Do not commit `.env.local` to Git (ensure it's in `.gitignore`)

4. **Rate Limits**
   - Approved API keys have a **1 request per second** rate limit
   - See [API_KEY_EMAIL_SUMMARY.md](./API_KEY_EMAIL_SUMMARY.md) for details

## Troubleshooting

### Issue 1: Form Not Displaying

**Solution**:

- Reload the page
- Clear browser cache
- Try a different browser

### Issue 2: Email Not Received

**Solution**:

- Check your spam folder
- Verify your email address is correct
- Wait a few days and check again
- Contact Semantic Scholar support

### Issue 3: Request Not Approved

**Solution**:

- Provide a more detailed use case description
- If it's for commercial use, clearly state that
- Submit the request again

## Reference Links

- [Semantic Scholar API Page](https://www.semanticscholar.org/product/api)
- [API Tutorial](https://www.semanticscholar.org/product/api/tutorial)
- [API Documentation](https://api.semanticscholar.org/api-docs/)
- [Terms of Service](https://api.semanticscholar.org/license/)

---

Last Updated: 2025-01-28 17:15:00 JST
