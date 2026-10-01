import asyncio
import httpx
from app.database import AsyncSessionLocal
from app.models import User, Role
from app.security import get_password_hash
from sqlalchemy.future import select

async def prepare_users():
    async with AsyncSessionLocal() as session:
        # Check / Create Finance Officer
        fo_role = (await session.execute(select(Role).where(Role.name == 'Finance Officer'))).scalar_one_or_none()
        if not fo_role:
            fo_role = Role(name='Finance Officer')
            session.add(fo_role)
            await session.commit()
            await session.refresh(fo_role)

        fo = (await session.execute(select(User).where(User.email == 'finance@example.com'))).scalar_one_or_none()
        if not fo:
            fo = User(
                email='finance@example.com',
                hashed_password=get_password_hash('Finance@123456'),
                full_name='Finance Director',
                status='APPROVED',
                roles=[fo_role]
            )
            session.add(fo)
            await session.commit()
            print('Created test finance officer: finance@example.com')
        else:
            fo.status = 'APPROVED'
            fo.hashed_password = get_password_hash('Finance@123456')
            fo.roles = [fo_role]
            await session.commit()

        # Check / Create Auditor
        aud_role = (await session.execute(select(Role).where(Role.name == 'Auditor'))).scalar_one_or_none()
        if not aud_role:
            aud_role = Role(name='Auditor')
            session.add(aud_role)
            await session.commit()
            await session.refresh(aud_role)

        aud = (await session.execute(select(User).where(User.email == 'auditor@example.com'))).scalar_one_or_none()
        if not aud:
            aud = User(
                email='auditor@example.com',
                hashed_password=get_password_hash('Auditor@123456'),
                full_name='Internal Auditor',
                status='APPROVED',
                roles=[aud_role]
            )
            session.add(aud)
            await session.commit()
            print('Created test auditor: auditor@example.com')
        else:
            aud.status = 'APPROVED'
            aud.hashed_password = get_password_hash('Auditor@123456')
            aud.roles = [aud_role]
            await session.commit()

async def run_tests():
    await prepare_users()
    base = 'http://127.0.0.1:8000/api/v1'
    async with httpx.AsyncClient(timeout=10.0) as client:
        # Check health
        health = await client.get('http://127.0.0.1:8000/health')
        print('Backend health:', health.status_code, health.json())

        # 1. Test Administrator
        admin_res = await client.post(f'{base}/auth/login', json={'email': 'admin@example.com', 'password': 'Admin@123456'})
        assert admin_res.status_code == 200, f'Admin login failed: {admin_res.text}'
        admin_token = admin_res.json()['access_token']
        admin_headers = {'Authorization': f'Bearer {admin_token}'}

        pdf_admin = await client.get(f'{base}/reports/vendor-performance?format=pdf', headers=admin_headers)
        excel_admin = await client.get(f'{base}/reports/vendor-performance?format=excel', headers=admin_headers)
        assert pdf_admin.status_code == 200, f'Admin PDF failed: {pdf_admin.status_code} {pdf_admin.text}'
        assert excel_admin.status_code == 200, f'Admin Excel failed: {excel_admin.status_code} {excel_admin.text}'
        print(f'[PASS] Administrator: PDF ({len(pdf_admin.content)} bytes) & Excel ({len(excel_admin.content)} bytes) downloaded successfully (200 OK)')

        # 2. Test Procurement Manager
        pm_res = await client.post(f'{base}/auth/login', json={'email': 'pm@example.com', 'password': 'Procurement@123456'})
        assert pm_res.status_code == 200, f'PM login failed: {pm_res.text}'
        pm_token = pm_res.json()['access_token']
        pm_headers = {'Authorization': f'Bearer {pm_token}'}

        pdf_pm = await client.get(f'{base}/reports/vendor-performance?format=pdf', headers=pm_headers)
        excel_pm = await client.get(f'{base}/reports/vendor-performance?format=excel', headers=pm_headers)
        assert pdf_pm.status_code == 200, f'PM PDF failed: {pdf_pm.status_code} {pdf_pm.text}'
        assert excel_pm.status_code == 200, f'PM Excel failed: {excel_pm.status_code} {excel_pm.text}'
        print(f'[PASS] Procurement Manager: PDF ({len(pdf_pm.content)} bytes) & Excel ({len(excel_pm.content)} bytes) downloaded successfully (200 OK)')

        # 3. Test Finance Officer
        fo_res = await client.post(f'{base}/auth/login', json={'email': 'finance@example.com', 'password': 'Finance@123456'})
        assert fo_res.status_code == 200, f'FO login failed: {fo_res.text}'
        fo_token = fo_res.json()['access_token']
        fo_headers = {'Authorization': f'Bearer {fo_token}'}

        pdf_fo = await client.get(f'{base}/reports/vendor-performance?format=pdf', headers=fo_headers)
        excel_fo = await client.get(f'{base}/reports/vendor-performance?format=excel', headers=fo_headers)
        assert pdf_fo.status_code == 200, f'FO PDF failed: {pdf_fo.status_code} {pdf_fo.text}'
        assert excel_fo.status_code == 200, f'FO Excel failed: {excel_fo.status_code} {excel_fo.text}'
        print(f'[PASS] Finance Officer: PDF ({len(pdf_fo.content)} bytes) & Excel ({len(excel_fo.content)} bytes) downloaded successfully (200 OK)')

        # 4. Test Blocked Role: Vendor
        ven_res = await client.post(f'{base}/auth/login', json={'email': 'vendor_user@example.com', 'password': 'Vendor@123456'})
        assert ven_res.status_code == 200, f'Vendor login failed: {ven_res.text}'
        ven_token = ven_res.json()['access_token']
        ven_headers = {'Authorization': f'Bearer {ven_token}'}

        pdf_ven = await client.get(f'{base}/reports/vendor-performance?format=pdf', headers=ven_headers)
        excel_ven = await client.get(f'{base}/reports/vendor-performance?format=excel', headers=ven_headers)
        assert pdf_ven.status_code == 403, f'Expected 403 for Vendor PDF, got: {pdf_ven.status_code}'
        assert excel_ven.status_code == 403, f'Expected 403 for Vendor Excel, got: {excel_ven.status_code}'
        print(f'[PASS] Vendor correctly blocked with 403 Forbidden for both PDF & Excel (detail: {pdf_ven.json().get("detail")})')

        # 5. Test Blocked Role: Auditor (not in allowed list)
        aud_res = await client.post(f'{base}/auth/login', json={'email': 'auditor@example.com', 'password': 'Auditor@123456'})
        assert aud_res.status_code == 200, f'Auditor login failed: {aud_res.text}'
        aud_token = aud_res.json()['access_token']
        aud_headers = {'Authorization': f'Bearer {aud_token}'}

        pdf_aud = await client.get(f'{base}/reports/vendor-performance?format=pdf', headers=aud_headers)
        excel_aud = await client.get(f'{base}/reports/vendor-performance?format=excel', headers=aud_headers)
        assert pdf_aud.status_code == 403, f'Expected 403 for Auditor PDF, got: {pdf_aud.status_code}'
        assert excel_aud.status_code == 403, f'Expected 403 for Auditor Excel, got: {excel_aud.status_code}'
        print(f'[PASS] Auditor correctly blocked with 403 Forbidden for both PDF & Excel (detail: {pdf_aud.json().get("detail")})')

        # Also test all other 4 report endpoints for Administrator to confirm 100% coverage
        endpoints = ['procurement', 'purchase-orders', 'compliance', 'contracts']
        for ep in endpoints:
            p_res = await client.get(f'{base}/reports/{ep}?format=pdf', headers=admin_headers)
            e_res = await client.get(f'{base}/reports/{ep}?format=excel', headers=admin_headers)
            assert p_res.status_code == 200, f'{ep} PDF failed'
            assert e_res.status_code == 200, f'{ep} Excel failed'
        print('[PASS] All 5 report endpoints successfully verified for PDF & Excel export.')

if __name__ == '__main__':
    asyncio.run(run_tests())
