export default async function TestPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return (
    <div style={{ background: 'red', color: 'white', padding: '50px', fontSize: '30px' }}>
      TEST PAGE RENDERING - Slug: {slug}
    </div>
  )
}
