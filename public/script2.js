// API Keys
    const YOUTUBE_API_KEY = 'AIzaSyD6iUJ9tpIF0EDrrnoJ_OCRmyeMkBOj_6k';

    let isLoading = false;
    let currentFilter = 'all';
    let skillKeywords = [];

    document.getElementById('skill-input').addEventListener('keypress', function(e) {
      if (e.key === 'Enter') handleSubmit();
    });

    async function handleSubmit() {
      const skillInput = document.getElementById('skill-input');
      const skill = skillInput.value.trim();
      if (!skill) {
        showError('Please enter a skill to search for!');
        return;
      }
      if (isLoading) return;

      document.getElementById('filter-options').style.display = 'block';
      isLoading = true;
      showLoading('Generating roadmap, extracting keywords, and finding comprehensive video courses...');
      try {
        const [roadmap, keywords, videos] = await Promise.all([
          generateRoadmap(skill),
          generateSkillKeywords(skill),
          searchYouTubeVideos(skill)
        ]);
        skillKeywords = keywords;
        displayResults(skill, roadmap, videos);
      } catch (error) {
        console.error('Error:', error);
        showError('Something went wrong. Please try again.');
      } finally {
        isLoading = false;
      }
    }

    async function generateRoadmap(skill) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [{
              role: 'user',
              content: `Create a comprehensive learning roadmap for "${skill}". Include:
              1. Prerequisites and foundational knowledge needed
              2. Core concepts to master step by step
              3. Detailed learning path from beginner to advanced
              4. Advanced topics and specializations
              5. Practical projects to build portfolio
              6. Realistic timeline estimates for each phase
              7. Career opportunities and next steps
              Format it clearly with sections and bullet points for easy reading.`
            }],
            max_tokens: 2500,
            temperature: 0.3
          })
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(`Groq API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }
        const data = await response.json();
        return data.choices[0].message.content;
      } catch (error) {
        console.error('Roadmap generation error:', error);
        return `## Learning Roadmap for ${skill}
**Note:** Unable to generate detailed roadmap at the moment. Here's a basic structure:
### Getting Started
- Research fundamentals and basic concepts
- Set up necessary tools and environment
- Find quality learning resources
### Core Learning Phase
- Study fundamental principles
- Practice with hands-on exercises
- Build small projects
### Advanced Topics
- Explore specialized areas
- Work on complex projects
- Connect with community
### Mastery Phase
- Contribute to open source
- Mentor others
- Stay updated with trends
*Please try again for a more detailed roadmap.*`;
      }
    }

    async function generateSkillKeywords(skill) {
      try {
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama3-8b-8192',
            messages: [{
              role: 'user',
              content: `Generate exactly 10 important keywords/concepts that someone must learn to master "${skill}". 
              Focus on core technical terms, methodologies, tools, and concepts.
              Return only the keywords separated by commas, no explanations or numbering.
              Example format: keyword1, keyword2, keyword3, keyword4, keyword5, keyword6, keyword7, keyword8, keyword9, keyword10`
            }],
            max_tokens: 200,
            temperature: 0.3
          })
        });
        if (!response.ok) throw new Error(`Groq API error: ${response.status}`);
        const data = await response.json();
        const keywordString = data.choices[0].message.content.trim();
        return keywordString.split(',').map(k => k.trim().toLowerCase()).slice(0, 10);
      } catch (error) {
        console.error('Keywords generation error:', error);
        return [skill.toLowerCase(), 'tutorial', 'course', 'learn', 'guide', 'beginner', 'advanced', 'complete', 'full', 'master'];
      }
    }

    function calculateKeywordScore(videoTitle, videoDescription, keywords) {
      const text = (videoTitle + ' ' + (videoDescription || '')).toLowerCase();
      let matchCount = 0;
      keywords.forEach(keyword => {
        if (text.includes(keyword)) matchCount++;
      });
      return (matchCount / keywords.length) * 100;
    }

    function setFilter(filterType) {
      currentFilter = filterType;
      document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelector(`[data-filter="${filterType}"]`).classList.add('active');
      const skill = document.getElementById('skill-input').value.trim();
      if (skill) handleSubmit();
    }

    // --- FIXED YOUTUBE SEARCH FUNCTION ---
    async function searchYouTubeVideos(skill) {
      try {
        const searchQueries = [
          `${skill} complete course tutorial`,
          `${skill} full course masterclass`,
          `${skill} comprehensive tutorial`,
          `learn ${skill} complete guide`
        ];
        let allVideos = [];
        for (const query of searchQueries) {
          const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(query)}&type=video&order=relevance&maxResults=20&key=${YOUTUBE_API_KEY}`;
          const searchResponse = await fetch(searchUrl);
          if (!searchResponse.ok) continue;
          const searchData = await searchResponse.json();
          if (searchData.items) allVideos = allVideos.concat(searchData.items);
        }
        if (allVideos.length === 0) return [];

        // Remove duplicates and filter valid video IDs
        const uniqueVideos = allVideos.filter((video, idx, self) =>
          video.id && video.id.videoId &&
          idx === self.findIndex(v => v.id && v.id.videoId === video.id.videoId)
        );
        const videoIdsArr = uniqueVideos
          .map(item => item.id?.videoId)
          .filter(id => id && id.trim() !== '');
        if (videoIdsArr.length === 0) return [];

        const videoIds = videoIdsArr.slice(0, 50).join(',');
        const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics,contentDetails&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
        const detailsResponse = await fetch(detailsUrl);
        if (!detailsResponse.ok) {
          const errorData = await detailsResponse.json().catch(() => ({}));
          console.error('YouTube API error:', detailsResponse.status, errorData.error);
          throw new Error('YouTube details fetch failed');
        }
        const detailsData = await detailsResponse.json();
        if (!detailsData.items || detailsData.items.length === 0) return [];

        const processedVideos = detailsData.items
          .map(video => {
            const stats = video.statistics;
            const duration = video.contentDetails.duration;
            const views = parseInt(stats.viewCount) || 0;
            const likes = parseInt(stats.likeCount) || 0;
            const durationMinutes = parseDuration(duration);
            const likesToViewsRatio = views > 0 ? (likes / views) * 100 : 0;
            const keywordScore = calculateKeywordScore(
              video.snippet.title,
              video.snippet.description,
              skillKeywords
            );
            const combinedScore = (likesToViewsRatio * 0.5) + (keywordScore * 0.5);

            
            return {
              id: video.id,
              title: video.snippet.title,
              channelTitle: video.snippet.channelTitle,
              thumbnail: video.snippet.thumbnails.medium.url,
              views: views,
              likes: likes,
              duration: durationMinutes,
              publishedAt: video.snippet.publishedAt,
              likesToViewsRatio: likesToViewsRatio,
              keywordScore: keywordScore,
              combinedScore: combinedScore
            };
          })
          .filter(video => {
            if (video.likes < 50 || video.views < 1000) return false;
            if (currentFilter === 'long') return video.duration >= 60;
            else if (currentFilter === 'short') return video.duration < 60 && video.duration >= 5;
            else return video.duration >= 5;
          })
          .sort((a, b) => b.combinedScore - a.combinedScore)
          .slice(0, 8);

          //Change

            console.log("🔎 Final Video Metadata:");
processedVideos.forEach((video, index) => {
  console.log(`\n📹 Video #${index + 1}`);
  console.log(`Title: ${video.title}`);
  console.log(`Channel: ${video.channelTitle}`);
  console.log(`Duration: ${video.duration} min`);
  console.log(`Views: ${video.views}`);
  console.log(`Likes: ${video.likes}`);
  console.log(`Engagement: ${video.likesToViewsRatio.toFixed(2)}%`);
  console.log(`Keyword Score: ${video.keywordScore.toFixed(2)}%`);
  console.log(`Combined Score: ${video.combinedScore.toFixed(2)}%`);
  console.log(`Published: ${video.publishedAt}`);
  console.log(`URL: https://www.youtube.com/watch?v=${video.id}`);
});
console.log("🎯 Skill:", skill);
console.log("🧠 Keywords:", skillKeywords);

//change end

        return processedVideos;
      } catch (error) {
        console.error('YouTube search error:', error);
        return [];
      }
    }
    // --- END FIXED FUNCTION ---

    function parseDuration(duration) {
      const regex = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/;
      const matches = duration.match(regex);
      const hours = parseInt(matches[1]) || 0;
      const minutes = parseInt(matches[2]) || 0;
      const seconds = parseInt(matches[3]) || 0;
      return hours * 60 + minutes + (seconds > 0 ? 1 : 0);
    }

    function showLoading(message) {
      const resultsContainer = document.getElementById('results-container');
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = `
        <div class="loading">
          <div class="spinner"></div>
          ${message}
        </div>
      `;
      resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    function showError(message) {
      const resultsContainer = document.getElementById('results-container');
      resultsContainer.style.display = 'block';
      resultsContainer.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-triangle"></i> ${message}
        </div>
      `;
      resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    function displayResults(skill, roadmap, videos) {
      const resultsContainer = document.getElementById('results-container');
      resultsContainer.style.display = 'block';
      let html = `
        <div class="roadmap-section">
          <h2><i class="fas fa-map-marked-alt"></i> Learning Roadmap for ${skill}</h2>
          <div class="roadmap-content">${formatRoadmap(roadmap)}</div>
        </div>
      `;
      if (videos.length > 0) {
        html += `
          <div class="videos-section">
            <h2><i class="fab fa-youtube"></i> Comprehensive Video Courses (${videos.length})</h2>
            <div class="video-filters-info">
              <i class="fas fa-filter"></i>
              Showing only complete courses (1+ hour duration) with high engagement
            </div>
        `;
        videos.forEach((video, index) => {
          html += createVideoCard(video, index);
        });
        html += '</div>';
      } else {
        html += `
          <div class="videos-section">
            <h2><i class="fab fa-youtube"></i> Comprehensive Video Courses</h2>
            <div class="no-results">
              <i class="fas fa-video-slash"></i>
              <p>No comprehensive video courses found matching the criteria (1+ hour duration).</p>
              <p>Try searching for a different skill or check back later.</p>
            </div>
          </div>
        `;
      }
      resultsContainer.innerHTML = html;
      resultsContainer.scrollIntoView({ behavior: 'smooth' });
    }

    function formatRoadmap(roadmap) {
      return roadmap
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^(\d+\..*$)/gm, '<br><strong>$1</strong>')
        .replace(/^(#{1,3}.*$)/gm, '<br><strong style="font-size: 1.1em; color: #1F2937;">$1</strong><br>');
    }

    function createVideoCard(video, index) {
      const hours = Math.floor(video.duration / 60);
      const minutes = video.duration % 60;
      const durationText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
      return `
        <div class="video-card" style="animation-delay: ${index * 0.1}s">
          <img src="${video.thumbnail}" alt="${video.title}" class="video-thumbnail" 
               onclick="openVideo('${video.id}')">
          <div class="video-info">
            <div class="video-title" onclick="openVideo('${video.id}')">${video.title}</div>
            <div class="video-channel">${video.channelTitle}</div>
            <div class="video-stats">
              <div class="stat">
                <i class="fas fa-eye"></i>
                ${formatNumber(video.views)} views
              </div>
              <div class="stat">
                <i class="fas fa-thumbs-up"></i>
                ${formatNumber(video.likes)} likes
              </div>
              <div class="stat">
                <i class="fas fa-calendar"></i>
                ${formatDate(video.publishedAt)}
              </div>
            </div>
            <div style="margin-top: 10px;">
              <span class="duration-badge">
                <i class="fas fa-clock"></i> ${durationText}
              </span>
              <span class="quality-score" title="Engagement: ${video.likesToViewsRatio.toFixed(3)}% | Keywords: ${video.keywordScore.toFixed(1)}%">
                Score: ${video.combinedScore.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      `;
    }

    function formatNumber(num) {
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      else if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toString();
    }

    function formatDate(dateString) {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now - date);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays < 30) return `${diffDays} days ago`;
      else if (diffDays < 365) {
        const months = Math.floor(diffDays / 30);
        return `${months} month${months > 1 ? 's' : ''} ago`;
      } else {
        const years = Math.floor(diffDays / 365);
        return `${years} year${years > 1 ? 's' : ''} ago`;
      }
    }

    function openVideo(videoId) {
      window.open(`https://www.youtube.com/watch?v=${videoId}`, '_blank');
    }

    document.addEventListener('DOMContentLoaded', function() {
      console.log('Skill Learning Assistant loaded successfully!');
      document.getElementById('skill-input').focus();
    });