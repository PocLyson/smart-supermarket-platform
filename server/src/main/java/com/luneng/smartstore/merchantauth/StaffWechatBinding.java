package com.luneng.smartstore.merchantauth;

import com.luneng.smartstore.staff.StaffAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "staff_wechat_binding")
public class StaffWechatBinding {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "staff_id", nullable = false)
    private StaffAccount staff;

    @Column(name = "app_id", nullable = false, length = 64)
    private String appId;

    @Column(nullable = false, length = 128)
    private String openid;

    @Column(nullable = false)
    private boolean enabled;

    @Column(name = "bound_at", nullable = false)
    private Instant boundAt;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @Column(name = "unbound_at")
    private Instant unboundAt;

    protected StaffWechatBinding() {
    }

    public StaffWechatBinding(StaffAccount staff, String appId, String openid, Instant now) {
        this.staff = staff;
        this.appId = appId;
        this.openid = openid;
        this.enabled = true;
        this.boundAt = now;
        this.lastLoginAt = now;
    }

    public StaffAccount getStaff() {
        return staff;
    }

    public String getAppId() {
        return appId;
    }

    public String getOpenid() {
        return openid;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void recordLogin(Instant now) {
        this.lastLoginAt = now;
    }

    public void unbind(Instant now) {
        this.enabled = false;
        this.unboundAt = now;
    }
}
