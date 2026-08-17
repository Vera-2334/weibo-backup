export default function PostsLoading() {
  return (
    <div className="page-container">
      {/* Nav skeleton */}
      <div style={{ height: 64 }} />

      {/* Filter skeleton */}
      <div className="skeleton" style={{ height: 96, borderRadius: "var(--r-lg)", marginBottom: 14 }} />

      {/* Post card skeletons */}
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="skeleton"
          style={{ height: 180, borderRadius: "var(--r-md)", marginBottom: 12 }}
        />
      ))}
    </div>
  );
}