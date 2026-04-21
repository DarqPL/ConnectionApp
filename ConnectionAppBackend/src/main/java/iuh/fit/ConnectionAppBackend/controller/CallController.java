package iuh.fit.ConnectionAppBackend.controller;

import iuh.fit.ConnectionAppBackend.domain.dto.CallActionRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.CallParticipantStateRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.CallSessionResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.CallStartRequest;
import iuh.fit.ConnectionAppBackend.domain.dto.CallTokenResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.PageResponse;
import iuh.fit.ConnectionAppBackend.domain.dto.CallHistoryItemResponse;
import iuh.fit.ConnectionAppBackend.service.CallService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/calls")
public class CallController {

    @Autowired
    private CallService callService;

    @PostMapping("/session")
    public ResponseEntity<CallSessionResponse> startCall(
            Authentication authentication,
            @RequestBody CallStartRequest request) {

        CallSessionResponse response = callService.startCall(authentication.getName(), request);
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{callId}")
    public ResponseEntity<CallSessionResponse> getCallDetails(
            Authentication authentication,
            @PathVariable Long callId) {

        CallSessionResponse response = callService.getCallDetails(authentication.getName(), callId);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/token")
    public ResponseEntity<CallTokenResponse> issueToken(
            Authentication authentication,
            @RequestParam Long callId) {

        CallTokenResponse response = callService.issueToken(authentication.getName(), callId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{callId}/accept")
    public ResponseEntity<CallSessionResponse> acceptCall(
            Authentication authentication,
            @PathVariable Long callId) {

        CallSessionResponse response = callService.acceptCall(authentication.getName(), callId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{callId}/reject")
    public ResponseEntity<CallSessionResponse> rejectCall(
            Authentication authentication,
            @PathVariable Long callId) {

        CallSessionResponse response = callService.rejectCall(authentication.getName(), callId);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/{callId}/end")
    public ResponseEntity<CallSessionResponse> endCall(
            Authentication authentication,
            @PathVariable Long callId,
            @RequestBody(required = false) CallActionRequest request) {

        CallSessionResponse response = callService.endCall(authentication.getName(), callId, request);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{callId}/participants/me")
    public ResponseEntity<CallSessionResponse> updateParticipantState(
            Authentication authentication,
            @PathVariable Long callId,
            @RequestBody CallParticipantStateRequest request) {

        CallSessionResponse response = callService.updateParticipantState(authentication.getName(), callId, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/history")
    public ResponseEntity<PageResponse<CallHistoryItemResponse>> getHistory(
            Authentication authentication,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {

        PageResponse<CallHistoryItemResponse> response = callService.getCallHistory(authentication.getName(), page, size);
        return ResponseEntity.ok(response);
    }
}
