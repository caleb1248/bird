const cacheName = "cache";

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.open(cacheName).then(async (cache) => {
      // Go to the cache first
      const cachedResponse = await cache.match(event.request.url);
      // Return a cached response if we have one
      if (cachedResponse) {
        return cachedResponse;
      }
      const fetchedResponse = await fetch(event.request);
      // Add the network response to the cache for later visits
      cache.put(event.request, fetchedResponse.clone());
      return fetchedResponse;
    })
  );
});
