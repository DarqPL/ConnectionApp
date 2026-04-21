const SentRequests = () => {
  // Note: Backend doesn't have a "sent requests" endpoint.
  // The pending requests endpoint returns requests where the current user is the receiver.
  // To show sent requests, you would need to add a backend endpoint.
  // For now, this shows an empty state.

  return (
    <div className="space-y-3 mt-4">
      <p className="text-sm text-muted-foreground">
        Tính năng xem lời mời đã gửi đang được phát triển.
      </p>
    </div>
  );
};

export default SentRequests;
