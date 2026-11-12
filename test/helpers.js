/** Build fixtures that mimic X's nested-escaped profile HTML. */

export function makePage({ handle = 'example', name = 'Example User', bio = 'Hello & welcome', tweets = [] } = {}) {
  const payload = {
    data: {
      user_result_by_screen_name: {
        result: {
          core: { name, screen_name: handle },
          profile_bio: { description: bio },
          avatar: { image_url: 'https://pbs.twimg.com/profile_images/1/a_normal.jpg' },
          relationship_counts: { followers: 1234, following: 42 },
          timeline: {
            items: tweets.map((tweet) => ({
              counts: { favorite_count: 7, retweet_count: 1 },
              details: {
                created_at_ms: tweet.ms,
                display_text_range: [0, tweet.text.length],
                full_text: tweet.text,
              },
              edit_control: { edit_tweet_ids: [tweet.id] },
            })),
          },
        },
      },
    },
  };
  // X serves this payload inside two levels of JS string escaping.
  const inner = JSON.stringify(payload);
  const escaped = JSON.stringify(inner);
  return (
    '<!doctype html><html><head><title>' +
    name +
    '</title></head><body><script type="application/json" id="__NEXT_DATA__">' +
    escaped +
    '</script></body></html>'
  );
}
