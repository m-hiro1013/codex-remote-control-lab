function prepareTurnStart({ threadId, text, attachments = [], options = {}, cwd, saveDataUrlAttachment, sandboxPolicyForMode }) {
  const input = [{ type: "text", text, text_elements: [] }];
  const savedImages = [];

  for (const attachment of attachments || []) {
    const saved = saveDataUrlAttachment(attachment);
    if (!saved) continue;
    input.push(saved.input);
    savedImages.push(saved.preview);
  }

  const requestParams = {
    threadId,
    input,
  };
  if (options.model) requestParams.model = options.model;
  if (options.approvalPolicy) requestParams.approvalPolicy = options.approvalPolicy;
  if (options.sandboxMode) requestParams.sandboxPolicy = sandboxPolicyForMode(options.sandboxMode, cwd);

  const displayText = savedImages.length ? `${text}\n\n添付: ${savedImages.map((image) => image.name).join(", ")}` : text;
  return {
    requestParams,
    displayText,
    savedImages,
  };
}

function approvalResponseFor(requestMsg, decision) {
  if (!requestMsg || !requestMsg.id || !requestMsg.method) return null;
  const accept = decision === "accept";
  return {
    id: requestMsg.id,
    result: { decision: accept ? "accept" : "decline" },
  };
}

module.exports = {
  approvalResponseFor,
  prepareTurnStart,
};
